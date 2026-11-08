import { requireUser } from '../../lib/auth';
export default async function GuardianPage() { const user = await requireUser(); return <main className="mx-auto max-w-xl py-24 text-center"><h1 className="text-3xl font-bold">Welcome, {user.fullName}</h1><p className="mt-3 text-slate-600">You are signed in as {user.role.toLowerCase()}. Guardian tools are coming in a later phase.</p></main>; }
