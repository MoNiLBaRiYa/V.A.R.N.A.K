import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DealerDiscoveryService } from '@/lib/dealers/discovery-service';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    paintBrand: {
      findUnique: vi.fn(),
    },
    dealer: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    GOOGLE_PLACES_API_KEY: 'test-places-key',
  },
}));

describe('Google Places Dealer Discovery (02-05 Task 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists discovered dealers strictly with state=THIRD_PARTY_DISCOVERED and never VERIFIED_OFFICIAL', async () => {
    (prisma.paintBrand.findUnique as any).mockResolvedValue({
      id: 'brand-asian-paints',
      name: 'Asian Paints',
      slug: 'asian-paints',
    });

    (prisma.dealer.create as any).mockImplementation(({ data }: any) => ({
      id: 'dealer-123',
      name: data.name,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      state: data.state,
      phone: null,
    }));

    const dealers = await DealerDiscoveryService.discoverDealers(12.9716, 77.5946, 'asian-paints');

    expect(dealers.length).toBeGreaterThan(0);
    for (const d of dealers) {
      expect(d.state).toBe('THIRD_PARTY_DISCOVERED');
    }

    expect(prisma.dealer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: 'THIRD_PARTY_DISCOVERED',
          brands: expect.objectContaining({
            create: expect.objectContaining({
              brandId: 'brand-asian-paints',
            }),
          }),
        }),
      })
    );
  });
});
