import React from "react";

async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <div>Edit settings for user: {params.id}</div>;
}

export default Page;
