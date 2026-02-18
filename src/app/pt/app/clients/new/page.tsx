import NewClientForm from "../NewClientForm";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <NewClientForm error={params.error} />;
}
