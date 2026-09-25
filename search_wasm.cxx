#include <iostream>
#include <string>
#include <vector>
#include "sqlite3.h"
#include <algorithm>
#include <sstream>
#include <cctype>
#include <cmath>     
#include <ctime>     
#include <chrono>
#include <iomanip>
#include <unordered_set>
#include <unordered_map>
#include <emscripten/bind.h>

const std::string DEFAULT_SEARCH_LANG = "en-US";
const double RECENCY_HALF_LIFE_DAYS = 30.0;
const double PAGERANK_WEIGHT = 1.2;
const int MAX_RESULTS_PER_DOMAIN = 2;

const std::unordered_set<std::string> STOPWORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with", "is", "are", "was", "were",
    "yang", "di", "ke", "dari", "dan", "atau", "ini", "itu", "untuk", "pada", "adalah", "dengan", "http", "https", "www"
};

struct Document {
    std::string url;
    std::string domain;
    std::string title;
    std::string snippet;
    std::string favicon;
    std::string lang;
    std::string updated_at;
    double pagerank = 0.0;
    double raw_bm25 = 0.0;
    double final_score = 0.0;
    bool is_demoted = false;
    int domain_count = 1;
};

// Helper: Escape string khusus JSON
std::string escapeJson(const std::string& s) {
    std::string o;
    o.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '"':  o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\b': o += "\\b";  break;
            case '\f': o += "\\f";  break;
            case '\n': o += "\\n";  break;
            case '\r': o += "\\r";  break;
            case '\t': o += "\\t";  break;
            default:   o += c;      break;
        }
    }
    return o;
}

// Helper: Format angka besar dengan koma (contoh: 12140000 -> "12,140,000")
std::string formatWithCommas(long long num) {
    std::string str = std::to_string(num);
    int insertPosition = static_cast<int>(str.length()) - 3;
    while (insertPosition > 0) {
        str.insert(insertPosition, ",");
        insertPosition -= 3;
    }
    return str;
}

std::string toLower(const std::string& str) {
    std::string res = str;
    for (char &c : res) c = std::tolower(static_cast<unsigned char>(c));
    return res;
}

std::string stripHTMLTags(const std::string& html) {
    std::string result;
    bool inTag = false;
    for (char c : html) {
        if (c == '<') inTag = true;
        else if (c == '>') inTag = false;
        else if (!inTag) result += c;
    }
    return result;
}

std::string sanitizeFtsToken(const std::string& token) {
    std::string clean;
    for (char c : token) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            clean += c;
        }
    }
    return clean;
}

std::vector<std::string> tokenize(const std::string& text) {
    std::vector<std::string> tokens;
    std::stringstream ss(text);
    std::string token;
    while (ss >> token) {
        std::string clean = sanitizeFtsToken(token);
        if (!clean.empty()) {
            tokens.push_back(clean);
        }
    }
    return tokens;
}

std::string generateDynamicSnippet(const std::string& rawContent, const std::vector<std::string>& queryTokens, size_t maxLen = 160) {
    std::string cleanText = stripHTMLTags(rawContent);
    if (cleanText.empty()) return "Deskripsi tidak tersedia.";

    std::string lowerText = toLower(cleanText);
    size_t firstMatchPos = std::string::npos;

    for (const auto& token : queryTokens) {
        size_t pos = lowerText.find(toLower(token));
        if (pos != std::string::npos) {
            if (firstMatchPos == std::string::npos || pos < firstMatchPos) {
                firstMatchPos = pos;
            }
        }
    }

    size_t startPos = 0;
    if (firstMatchPos != std::string::npos && firstMatchPos > 30) {
        startPos = firstMatchPos - 30;
    }

    std::string excerpt = cleanText.substr(startPos, maxLen);
    if (startPos > 0) excerpt = "..." + excerpt;
    if (startPos + maxLen < cleanText.length()) excerpt += "...";

    for (const auto& token : queryTokens) {
        if (token.length() < 2) continue;
        std::string lowerExcerpt = toLower(excerpt);
        std::string lowerToken = toLower(token);
        
        std::string newExcerpt = "";
        size_t lastIdx = 0;
        size_t foundIdx = 0;

        while ((foundIdx = lowerExcerpt.find(lowerToken, lastIdx)) != std::string::npos) {
            newExcerpt += excerpt.substr(lastIdx, foundIdx - lastIdx);
            newExcerpt += excerpt.substr(foundIdx, token.length());
            lastIdx = foundIdx + token.length();
        }
        newExcerpt += excerpt.substr(lastIdx);
        excerpt = newExcerpt;
    }

    return excerpt;
}

std::string detectEffectiveLanguage(const std::string& storedLang, const std::string& url) {
    if (!storedLang.empty()) return storedLang;

    std::string u = toLower(url);
    const std::vector<std::pair<std::string, std::string>> locales = {
        {"/en-us", "en-US"}, {"/en-gb", "en-GB"}, {"/en-au", "en-AU"},
        {"/en-ca", "en-CA"}, {"/en", "en-US"},
        {"/id-id", "id-ID"}, {"/id", "id-ID"}
    };

    for (const auto& [prefix, lang] : locales) {
        if (u.find(prefix + "/") != std::string::npos ||
            (u.size() >= prefix.size() && u.rfind(prefix) == u.size() - prefix.size())) {
            return lang;
        }
    }
    return "";
}

bool isHomepageUrl(const std::string& url) {
    std::string u = toLower(url);
    size_t scheme = u.find("://");
    if (scheme == std::string::npos) return false;
    size_t hostStart = scheme + 3;
    size_t pathStart = u.find('/', hostStart);
    if (pathStart == std::string::npos) return true;
    std::string path = u.substr(pathStart);
    while (!path.empty() && path.back() == '/') path.pop_back();
    return path.empty();
}

std::string normalizedHost(const std::string& domain) {
    std::string d = toLower(domain);
    while (!d.empty() && d.back() == '/') d.pop_back();
    if (d.rfind("https://", 0) == 0) d = d.substr(8);
    else if (d.rfind("http://", 0) == 0) d = d.substr(7);
    if (d.rfind("www.", 0) == 0) d = d.substr(4);
    return d;
}

std::vector<Document> searchInDatabase(sqlite3* db, const std::string& keyword, const std::string& hl = "", const std::string& time_filter = "") {
    std::vector<Document> results;
    std::vector<std::string> tokens = tokenize(keyword);
    if (tokens.empty()) return results;

    std::vector<std::string> uniqueTokens;
    std::unordered_set<std::string> seenTokens;
    for (const auto& token : tokens) {
        std::string clean = toLower(sanitizeFtsToken(token));
        if (!clean.empty() && seenTokens.insert(clean).second) uniqueTokens.push_back(clean);
    }
    if (uniqueTokens.empty()) return results;

    std::string sql =
        "SELECT d.url, d.domain, d.title, d.snippet, d.favicon, d.lang, d.updated_at, d.pagerank, "
        "SUM(5.0 * ii.tf_title + 1.0 * ii.tf_body + 0.7 * ii.tf_anchor) AS raw_term_score, "
        "COUNT(DISTINCT ii.term) AS matched_terms "
        "FROM inverted_index ii JOIN documents d ON d.id = ii.doc_id WHERE ii.term IN (";

    for (size_t i = 0; i < uniqueTokens.size(); ++i) {
        if (i) sql += ",";
        sql += "?";
    }
    sql += ")";

    if (time_filter == "30m") sql += " AND d.updated_at >= datetime('now','-30 minutes')";
    else if (time_filter == "1h") sql += " AND d.updated_at >= datetime('now','-1 hour')";

    sql += " GROUP BY d.id HAVING COUNT(DISTINCT ii.term) = ? LIMIT 1500;";

    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
        return results;
    }

    int bindIdx = 1;
    for (const auto& token : uniqueTokens)
        sqlite3_bind_text(stmt, bindIdx++, token.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, bindIdx++, static_cast<int>(uniqueTokens.size()));

    const std::string lowerQuery = toLower(keyword);
    const std::string requestedLang = hl.empty() ? DEFAULT_SEARCH_LANG : hl;

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        Document doc;
        const unsigned char* url = sqlite3_column_text(stmt, 0);
        const unsigned char* domain = sqlite3_column_text(stmt, 1);
        const unsigned char* title = sqlite3_column_text(stmt, 2);
        const unsigned char* rawSnippet = sqlite3_column_text(stmt, 3);
        const unsigned char* favicon = sqlite3_column_text(stmt, 4);
        const unsigned char* storedLang = sqlite3_column_text(stmt, 5);
        const unsigned char* updatedAt = sqlite3_column_text(stmt, 6);

        doc.url = url ? reinterpret_cast<const char*>(url) : "";
        doc.domain = domain ? reinterpret_cast<const char*>(domain) : "";
        doc.title = title ? reinterpret_cast<const char*>(title) : "";
        doc.favicon = favicon ? reinterpret_cast<const char*>(favicon) : "";
        doc.updated_at = updatedAt ? reinterpret_cast<const char*>(updatedAt) : "";

        std::string originalLang = storedLang ? reinterpret_cast<const char*>(storedLang) : "";
        doc.lang = detectEffectiveLanguage(originalLang, doc.url);
        doc.snippet = generateDynamicSnippet(rawSnippet ? reinterpret_cast<const char*>(rawSnippet) : "", tokens);

        if (doc.snippet == "Deskripsi tidak tersedia.") {
            doc.snippet = "Indexed page matching your search query.";
        }

        doc.pagerank = sqlite3_column_double(stmt, 7);
        doc.raw_bm25 = sqlite3_column_double(stmt, 8);

        const bool homepage = isHomepageUrl(doc.url);
        const std::string cleanDomain = normalizedHost(doc.domain);
        const std::string queryHost = normalizedHost(doc.domain);

        bool languageMatch = (toLower(doc.lang) == toLower(requestedLang));
        bool rootNavigationalFallback = homepage && !cleanDomain.empty() && (lowerQuery == cleanDomain || lowerQuery == "www." + cleanDomain);

        if (toLower(requestedLang) != "all") {
            if (!languageMatch && !rootNavigationalFallback) continue;
        }

        double bm25_score = doc.raw_bm25 <= 0.0 ? 0.01 : doc.raw_bm25;
        double text_score = std::log1p(bm25_score);

        std::string lowerTitle = toLower(stripHTMLTags(doc.title));
        double title_boost = 1.0;
        if (!lowerQuery.empty() && !lowerTitle.empty() && lowerTitle.find(lowerQuery) != std::string::npos) {
            title_boost = 3.5;
        }

        double domain_boost = (queryHost == lowerQuery) ? 4.0 : 1.0;
        double homepage_boost = (homepage && queryHost == lowerQuery) ? 2.75 : 1.0;
        double pr_boost = 1.0 + std::log1p(std::max(0.0, doc.pagerank)) * PAGERANK_WEIGHT;

        doc.final_score = text_score * title_boost * domain_boost * homepage_boost * pr_boost;
        results.push_back(doc);
    }

    sqlite3_finalize(stmt);

    std::sort(results.begin(), results.end(), [](const Document& a, const Document& b) {
        return a.final_score > b.final_score;
    });

    return results;
}

// Fungsi utama yang dipanggil oleh JavaScript via WebAssembly
std::string searchJson(std::string query, std::string hl, std::string time_filter) {
    auto startTime = std::chrono::high_resolution_clock::now();

    static sqlite3* db = nullptr;
    if (!db) {
        if (sqlite3_open_v2("/search_engine.db", &db, SQLITE_OPEN_READONLY, nullptr) != SQLITE_OK) {
            return "{\"error\":\"Gagal membuka database /search_engine.db\"}";
        }
    }

    std::vector<Document> results = searchInDatabase(db, query, hl, time_filter);

    auto endTime = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = endTime - startTime;
    double searchTime = duration.count();

    std::ostringstream timeStream;
    timeStream << std::fixed << std::setprecision(6) << searchTime;
    std::string formattedSearchTimeStr = timeStream.str();
    
    std::ostringstream timeShortStream;
    timeShortStream << std::fixed << std::setprecision(2) << searchTime;
    std::string formattedSearchTimeShort = timeShortStream.str();

    long long totalResults = static_cast<long long>(results.size());

    // Membangun JSON persis dengan skema Google Custom Search API
    std::string json = "{";
    json += "\"engine\":\"web\",";
    json += "\"query\":\"" + escapeJson(query) + "\",";
    json += "\"searchInformation\":{";
    json += "\"searchTime\":" + formattedSearchTimeStr + ",";
    json += "\"formattedSearchTime\":\"" + formattedSearchTimeShort + "\",";
    json += "\"totalResults\":\"" + std::to_string(totalResults) + "\",";
    json += "\"formattedTotalResults\":\"" + formatWithCommas(totalResults) + "\"";
    json += "},";

    json += "\"items\":[";
    for (size_t i = 0; i < results.size(); ++i) {
        if (i > 0) json += ",";
        json += "{";
        json += "\"position\":" + std::to_string(i) + ",";
        json += "\"title\":\"" + escapeJson(stripHTMLTags(results[i].title)) + "\",";
        json += "\"link\":\"" + escapeJson(results[i].url) + "\",";
        json += "\"displayLink\":\"" + escapeJson(results[i].domain) + "\",";
        json += "\"snippet\":\"" + escapeJson(results[i].snippet) + "\",";
        
        // Pagemap untuk metatags/thumbnail jika tersedia dari database
        json += "\"pagemap\":{";
        json += "\"metatags\":[{";
        json += "\"viewport\":\"width=device-width, initial-scale=1.0\"";
        if (!results[i].favicon.empty()) {
            json += ",\"og:image\":\"" + escapeJson(results[i].favicon) + "\"";
        }
        json += "}]";
        json += "}";

        json += "}";
    }
    json += "],";
    json += "\"queries\":{\"nextPage\":[]}";
    json += "}";

    return json;
}

// Bind nama fungsi C++ ke JavaScript
EMSCRIPTEN_BINDINGS(search_engine_module) {
    emscripten::function("searchJson", &searchJson);
}
