import React from "react";

function Page({ params }) {
  console.log("Params:", params.id);
  return <div>Edit user: {params.id}</div>;
}

export default Page;
