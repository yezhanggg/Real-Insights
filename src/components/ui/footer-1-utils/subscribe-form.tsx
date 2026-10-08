// The footer's newsletter box (shadcn Input + Button), posting to the site's own /api/subscribe.
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubscribe } from '@/lib/subscribe';
import { useApp } from '@/lib/store';

export function SubscribeForm({ source = 'footer' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const subscribed = useApp((s) => s.subscribed);
  const { status, submit } = useSubscribe(source);
  if (subscribed || status.kind === 'done')
    return (
      <p className="flex items-center gap-1.5 font-medium text-emerald-700">
        <Check className="h-4 w-4" /> You're subscribed. New data lands in your inbox.
      </p>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(email);
      }}
      noValidate
    >
      <div className="flex gap-2">
        <Input type="email" autoComplete="email" aria-label="Email address" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 rounded-lg bg-white" />
        <Button type="submit" size="sm" disabled={status.kind === 'busy'} className="rounded-lg">
          {status.kind === 'busy' ? 'Adding…' : 'Subscribe'}
        </Button>
      </div>
      {status.kind === 'error' && <p className="text-xs text-rose-700">{status.message}</p>}
    </form>
  );
}
