export interface HubLocation {
  lat: number;
  lng: number;
}

export interface HubOperatingHours {
  open: string;
  close: string;
}

export interface Hub {
  id: string;
  name: string;
  code: string;
  address: string;
  location: HubLocation;
  contactPhone?: string | null;
  operatingHours: HubOperatingHours;
  isActive: boolean;
  isCanonical: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHubPayload {
  name: string;
  code: string;
  address: string;
  location: { lat: number; lng: number };
  contactPhone?: string | null;
  operatingHours?: { open?: string; close?: string };
  isActive?: boolean;
  isCanonical?: boolean;
}

export interface UpdateHubPayload {
  name?: string;
  code?: string;
  address?: string;
  location?: { lat: number; lng: number };
  contactPhone?: string | null;
  operatingHours?: { open?: string; close?: string };
  isActive?: boolean;
  isCanonical?: boolean;
}

export interface ClusterPreviewConsignment {
  deliveryId: string;
  orderReference: string;
  customerName?: string;
  location: [number, number];
  distanceKm: number;
}

export interface ClusterPreviewGroup {
  hub: Hub;
  deliveries: ClusterPreviewConsignment[];
  count: number;
}

export interface ClusterPreviewResult {
  clusters: ClusterPreviewGroup[];
  totalDeliveries: number;
  activeHubsCount: number;
}
