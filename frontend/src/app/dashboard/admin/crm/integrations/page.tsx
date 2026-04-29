'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Facebook, Instagram, Globe, Zap, CheckCircle2, XCircle,
  Plus, Trash2, RefreshCw, ExternalLink, AlertTriangle,
  Link2, Settings, MessageCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const PROVIDERS = [
  {
    id: 'META',
    label: 'Facebook & Instagram',
    description: 'Capture leads from Facebook Lead Ads, Instagram Ads, and Messenger DMs in real time.',
    icon: Facebook,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    connectPath: '/api/v1/integrations/meta/connect',
    features: ['Facebook Lead Forms', 'Instagram Lead Forms', 'Messenger DMs', 'Real-time webhooks'],
  },
  {
    id: 'GOOGLE',
    label: 'Google Ads',
    description: 'Capture leads from Google Search, Display, and YouTube lead form extensions.',
    icon: Globe,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-800',
    connectPath: '/api/v1/integrations/google/connect',
    features: ['Search Lead Forms', 'Display Lead Forms', 'YouTube Lead Forms', 'Keyword tracking'],
  },
  {
    id: 'WEBSITE',
    label: 'Website Lead Forms',
    description: 'Embed lead capture forms on your website. Leads appear in CRM instantly.',
    icon: Globe,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-950',
    border: 'border-indigo-200 dark:border-indigo-800',
    connectPath: null,
    features: ['Custom form builder', 'Embed anywhere', 'UTM tracking', 'Real-time capture'],
  },
];

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', fields: '[]' });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    load();
    // Show toast from OAuth callback
    const meta   = searchParams.get('meta');
    const google = searchParams.get('google');
    const error  = searchParams.get('error');
    if (meta === 'connected')   showToast('Facebook / Instagram connected!', 'success');
    if (google === 'connected') showToast('Google Ads connected!', 'success');
    if (error) showToast(decodeURIComponent(error), 'error');
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/integrations');
      setIntegrations(Array.isArray(data) ? data : []);
    } catch { /**/ } finally { setLoading(false); }
  };

  const connectProvider = async (provider: typeof PROVIDERS[0]) => {
    if (!provider.connectPath) { setFormOpen(true); return; }
    setConnecting(provider.id);
    try {
      const { url } = await api.get(provider.connectPath.replace('/api/v1', ''));
      window.location.href = url;
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally { setConnecting(null); }
  };

  const removeIntegration = async (id: string) => {
    if (!confirm('Disconnect this integration?')) return;
    await api.delete(`/integrations/${id}`);
    load();
    showToast('Integration disconnected', 'success');
  };

  const refreshToken = async (int: any) => {
    try {
      const endpoint = int.provider === 'META'
        ? `/integrations/${int.id}/meta/refresh`
        : `/integrations/${int.id}/google/refresh`;
      await api.post(endpoint);
      showToast('Token refreshed successfully', 'success');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const createWebsiteForm = async () => {
    try {
      const fields = JSON.parse(formData.fields);
      await api.post('/leads/forms', { name: formData.name, fields });
      showToast('Lead form created!', 'success');
      setFormOpen(false);
      setFormData({ name: '', fields: '[]' });
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const intByProvider = (providerId: string) =>
    integrations.filter((i) => i.provider === providerId);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-lg px-4 py-3 shadow-lg text-sm font-medium border',
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ad Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your ad platforms to capture leads automatically into the CRM
          </p>
        </div>
        <Link href="/dashboard/admin/crm/leads">
          <Button variant="outline" size="sm">View Leads</Button>
        </Link>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PROVIDERS.map((provider) => {
          const connected = intByProvider(provider.id);
          const Icon = provider.icon;
          return (
            <Card key={provider.id} className={cn('border-2', connected.length ? 'border-green-200 dark:border-green-800' : '')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={cn('p-2.5 rounded-xl', provider.bg)}>
                    <Icon className={cn('h-6 w-6', provider.color)} />
                  </div>
                  {connected.length > 0 && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {connected.length} Connected
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-3">{provider.label}</CardTitle>
                <CardDescription className="text-xs">{provider.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Features */}
                <ul className="space-y-1.5">
                  {provider.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Connected accounts */}
                {connected.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    {connected.map((int) => (
                      <div key={int.id} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{int.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {int.hasToken ? '●  Authenticated' : '○  No token'}
                            {int.lastSyncAt && ` · Synced ${new Date(int.lastSyncAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7"
                            title="Refresh token"
                            onClick={() => refreshToken(int)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeIntegration(int.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full"
                  variant={connected.length ? 'outline' : 'default'}
                  size="sm"
                  disabled={connecting === provider.id}
                  onClick={() => connectProvider(provider)}
                >
                  {connecting === provider.id ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  {connected.length ? 'Add Another Account' : `Connect ${provider.label}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* WhatsApp Click Ads info */}
      <Card className="border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950">
              <MessageCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">WhatsApp Click-to-Chat Ads</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When someone clicks your WhatsApp Ad and sends the first message,
                RMS automatically creates a hot lead. Requires WhatsApp Business API webhook setup.
              </p>
            </div>
            <div className="shrink-0">
              <p className="text-xs font-mono bg-muted px-3 py-2 rounded border">
                POST /api/v1/webhooks/whatsapp
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URLs for reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Webhook Endpoints</CardTitle>
          <CardDescription className="text-xs">
            Use these endpoints when configuring webhooks in Meta Business Manager or Google Ads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Meta (Facebook/Instagram)', url: '/api/v1/webhooks/meta', method: 'POST + GET' },
            { label: 'Google Ads',                url: '/api/v1/webhooks/google', method: 'POST' },
            { label: 'Website Lead Form',         url: '/api/v1/webhooks/form/:formId', method: 'POST' },
            { label: 'WhatsApp Business',         url: '/api/v1/webhooks/whatsapp', method: 'POST' },
          ].map((ep) => (
            <div key={ep.url} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg">
              <div>
                <p className="text-xs font-medium">{ep.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ep.method}</p>
              </div>
              <code className="text-xs font-mono bg-background border px-2 py-1 rounded">
                {process.env.NEXT_PUBLIC_API_URL}{ep.url}
              </code>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Website Form Builder Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Website Lead Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Form Name</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Homepage Contact Form"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Fields (JSON)</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                Each field: <code>{'{"name":"phone","label":"Phone","type":"tel","required":true}'}</code>
              </p>
              <textarea
                className="w-full font-mono text-xs border rounded-md p-2.5 h-36 resize-none bg-background"
                value={formData.fields}
                onChange={(e) => setFormData({ ...formData, fields: e.target.value })}
                placeholder='[{"name":"name","label":"Full Name","type":"text","required":true}]'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={createWebsiteForm} disabled={!formData.name.trim()}>Create Form</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
