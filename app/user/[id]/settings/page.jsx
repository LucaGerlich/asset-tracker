import React from "react";

async function Page(props) {
  const params = await props.params;
  console.log("Params:", params.id);
  return <div>Edit settings for user: {params.id}</div>;
}

export default Page;
