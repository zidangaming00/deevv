const API_KEY="80ae91cd43dd4d54b951b9efe5ca687b";
const ALLOWED_ORIGIN="https://deevv.pages.dev";

const CATEGORIES={
  restoran:"catering.restaurant,catering.fast_food",
  hotel:"accommodation.hotel,accommodation.motel,accommodation.hostel",
  "kedai kopi":"catering.cafe",
  spbu:"service.vehicle.fuel"
};

function cors(){
  return{
    "Access-Control-Allow-Origin":ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods":"GET,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Content-Type":"application/json; charset=utf-8"
  };
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:cors()
  });
}

export async function onRequestOptions(){
  return new Response(null,{status:204,headers:cors()});
}

export async function onRequestGet(context){
  try{
    const url=new URL(context.request.url);

    const lat=Number(url.searchParams.get("lat"));
    const lon=Number(url.searchParams.get("lon"));
    const category=(url.searchParams.get("category")||"").toLowerCase().trim();

    const radius=Math.min(
      Math.max(Number(url.searchParams.get("radius"))||3000,100),
      50000
    );

    const limit=Math.min(
      Math.max(Number(url.searchParams.get("limit"))||30,1),
      100
    );

    if(!Number.isFinite(lat)||!Number.isFinite(lon)){
      return json({error:"Invalid latitude or longitude"},400);
    }

    if(!CATEGORIES[category]){
      return json({
        error:"Invalid category",
        available:Object.keys(CATEGORIES)
      },400);
    }

    if(!API_KEY||API_KEY==="ISI_GEOAPIFY_API_KEY"){
      return json({error:"Geoapify API key belum diisi"},500);
    }

    const params=new URLSearchParams({
      apiKey:API_KEY,
      categories:CATEGORIES[category],
      filter:`circle:${lon},${lat},${radius}`,
      bias:`proximity:${lon},${lat}`,
      limit:String(limit),
      lang:"id"
    });

    const api=`https://api.geoapify.com/v2/places?${params}`;

    const response=await fetch(api,{
      headers:{
        "Accept":"application/json"
      }
    });

    const text=await response.text();

    if(!response.ok){
      return json({
        error:"Geoapify API error",
        status:response.status,
        detail:text
      },502);
    }

    let data;
    try{
      data=JSON.parse(text);
    }catch{
      return json({
        error:"Invalid response from Geoapify"
      },502);
    }

    const places=(data.features||[])
      .map((f,i)=>{
        const p=f.properties||{};
        const g=f.geometry||{};
        const coords=g.coordinates||[];

        const placeLon=Number(coords[0]);
        const placeLat=Number(coords[1]);

        if(!Number.isFinite(placeLat)||!Number.isFinite(placeLon)){
          return null;
        }

        return{
          id:p.place_id||p.datasource?.raw?.osm_id||`${category}-${i}`,
          name:p.name||p.address_line1||"Tanpa nama",
          category,
          lat:placeLat,
          lon:placeLon,
          distance_m:Number.isFinite(Number(p.distance))
            ?Number(p.distance)
            :null,
          address:p.formatted||p.address_line2||"",
          street:p.street||"",
          city:p.city||p.municipality||"",
          postcode:p.postcode||"",
          country:p.country||"Indonesia",
          phone:p.contact?.phone||p.datasource?.raw?.phone||"",
          website:p.website||p.contact?.website||"",
          opening_hours:p.opening_hours||null,
          image:p.datasource?.raw?.image||null
        };
      })
      .filter(Boolean);

    return json({
      type:"nearby",
      source:"geoapify",
      center:{lat,lon},
      radius_m:radius,
      category,
      count:places.length,
      places
    });
  }catch(error){
    return json({
      error:"Server error",
      detail:error?.message||String(error)
    },500);
  }
}
