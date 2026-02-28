'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Search, Loader2, MapPin, Bed, Bath, LandPlot, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api, getImageUrl } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'AVAILABLE': return <Badge variant="success">Available</Badge>;
    case 'SOLD': return <Badge variant="secondary">Sold</Badge>;
    case 'UNDER_CONTRACT': return <Badge className="bg-orange-100 text-orange-700">Under Contract</Badge>;
    case 'OFF_MARKET': return <Badge variant="outline">Off Market</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const getTypeIcon = (type: string) => {
  if (type === 'LAND') return <LandPlot className="w-5 h-5 text-primary" />;
  if (type === 'COMMERCIAL') return <Building2 className="w-5 h-5 text-primary" />;
  return <Home className="w-5 h-5 text-primary" />;
};

export default function GOPropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res: any = await api.get(`/properties?${params}`);
      const inner = res?.data ?? res;
      setProperties(Array.isArray(inner) ? inner : (inner?.data ?? []));
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const sold = properties.filter(p => p.status === 'SOLD').length;
  const available = properties.filter(p => p.status === 'AVAILABLE').length;
  const listed = properties.filter(p => p.isListed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-sm text-muted-foreground">Overview of all company properties</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="px-3 py-1">{properties.length} total</Badge>
          <Badge className="bg-green-100 text-green-700 px-3 py-1">{available} available</Badge>
          <Badge className="bg-blue-100 text-blue-700 px-3 py-1">{listed} listed</Badge>
          <Badge variant="secondary" className="px-3 py-1">{sold} sold</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            All Properties
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : properties.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">No properties found.</p>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {properties.map((p: any) => (
                <div key={p.id} className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-36 bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                    {p.images?.[0] ? (
                      <img src={getImageUrl(p.images[0])} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getTypeIcon(p.type)}
                      </div>
                    )}
                    <div className="absolute top-2 right-2">{getStatusBadge(p.status)}</div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {p.city}, {p.state}
                    </p>
                    <p className="text-primary font-bold mt-2">{formatCurrency(p.price)}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {p.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.bedrooms}</span>}
                      {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.bathrooms}</span>}
                      <Badge variant="outline" className="text-xs py-0">{p.type}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
