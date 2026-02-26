import KitCreateForm from "./ui/KitCreateForm";

export default function CreateKitPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Create Kit</h1>
      <KitCreateForm />
    </div>
  );
}
