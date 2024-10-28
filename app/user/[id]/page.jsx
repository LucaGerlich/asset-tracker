import React from "react";

function Page({ params }) {
  console.log("Params:", params.id);
  return <div>View Details: {params.id}</div>;
}

export default Page;
