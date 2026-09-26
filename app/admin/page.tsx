import { Moderation } from '@/components/moderation';
export const metadata={title:'Moderation · Kollab',robots:{index:false,follow:false}};
export default function Page(){return <main className="operations-page"><a href="/" className="wordmark">kollab.</a><Moderation/></main>;}
