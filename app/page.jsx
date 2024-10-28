import Link from "next/link";
import { Card, CardBody, CardHeader } from "./lib/nextui";
import { getAssets, getUsers, getAccessories } from "@/app/lib/data";

export default async function Home() {
  const user = await getUsers();
  const assets = await getAssets();
  const accessories = await getAccessories();

  return (
    <main>
      <h1 className="text-3xl">Dashboard</h1>
      <br />
      <div className="flex flex-row gap-8">
        <Link href="/assets" className="w-full h-28">
          <Card>
            <CardHeader>Total Assets</CardHeader>
            <CardBody className="text-5xl text-primary">
              {assets.length}
            </CardBody>
          </Card>
        </Link>
        <Link href="/accessories" className="w-full h-28">
          <Card>
            <CardHeader>Total Accessories</CardHeader>
            <CardBody className="text-5xl text-primary">
              {accessories.length}
            </CardBody>
          </Card>
        </Link>
        <Link href="/user" className="w-full h-28">
          <Card>
            <CardHeader>Total User</CardHeader>
            <CardBody className="text-5xl text-primary">{user.length}</CardBody>
          </Card>
        </Link>
      </div>
      <br />
      <br />
      <div className="flex flex-row gap-8">
        <Card className="w-2/3 h-72">
          <CardHeader>Latest Activity</CardHeader>
          <CardBody className="text-5xl text-primary"></CardBody>
        </Card>
        <Card className="w-1/3 h-72">
          <CardHeader>Statistics</CardHeader>
          <CardBody className="text-5xl text-primary"></CardBody>
        </Card>
      </div>
      {/* {user.map((user) => (
        <h1 key={user.userid}>{user.lastname}</h1>
      ))} */}
      {/* <DashboardTable /> */}
    </main>
  );
}
