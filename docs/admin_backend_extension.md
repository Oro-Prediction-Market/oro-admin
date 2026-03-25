# Admin Backend Extension Guide

This document provides the necessary code and logic to extend your existing admin backend. You can copy these snippets into your project files when you are ready to implement them.

## 1. Extending `MarketsService`
Add these methods to `src/markets/markets.service.ts` to support market editing and deletion.

```typescript
// Add to your imports
import { MarketStatus } from "../entities/market.entity";

// ... inside MarketsService class

async update(id: string, dto: Partial<CreateMarketDto>): Promise<Market> {
  const market = await this.findOne(id);
  // Only allow updates for Upcoming or Open markets
  if (market.status !== MarketStatus.UPCOMING && market.status !== MarketStatus.OPEN) {
    throw new Error("Can only update upcoming or open markets");
  }
  
  Object.assign(market, {
    title: dto.title ?? market.title,
    description: dto.description ?? market.description,
    imageUrl: dto.imageUrl ?? market.imageUrl,
    opensAt: dto.opensAt ? new Date(dto.opensAt) : market.opensAt,
    closesAt: dto.closesAt ? new Date(dto.closesAt) : market.closesAt,
    houseEdgePct: dto.houseEdgePct ?? market.houseEdgePct,
  });

  await this.marketRepo.save(market);
  return this.findOne(id);
}

async delete(id: string): Promise<void> {
  const market = await this.findOne(id);
  // Safety check: only delete Upcoming markets that haven't started
  if (market.status !== MarketStatus.UPCOMING) {
    throw new Error("Can only delete upcoming markets");
  }
  await this.marketRepo.remove(market);
}
```

## 2. Extending `AdminController`
Update your `src/admin/admin.controller.ts` with these new endpoints.

### DTO for User Management
```typescript
class UpdateUserDto {
  @ApiProperty()
  isAdmin: boolean;
}
```

### New Controller Methods
```typescript
// ── Market Management Extensions ──────────────────────────────────────────

@Patch("markets/:id")
@ApiOperation({ summary: "Update market details (Upcoming/Open only)" })
updateMarket(@Param("id") id: string, @Body() dto: Partial<CreateMarketDto>) {
  return this.marketsService.update(id, dto);
}

@Delete("markets/:id")
@HttpCode(204)
@ApiOperation({ summary: "Delete market (Upcoming only)" })
deleteMarket(@Param("id") id: string) {
  return this.marketsService.delete(id);
}

// ── User Management Extensions ──────────────────────────────────────────────

@Patch("users/:id/admin")
@ApiOperation({ summary: "Toggle user admin status" })
async updateUserAdmin(@Param("id") id: string, @Body() dto: UpdateUserDto) {
  await this.userRepo.update(id, { isAdmin: dto.isAdmin });
  return this.userRepo.findOneBy({ id });
}
```

## 3. Frontend Integration Summary
Once these are added, your admin page can perform:
1. **Edit Market**: Using `PATCH /admin/markets/:id`.
2. **Remove Market**: Using `DELETE /admin/markets/:id` (useful for cleaning up drafts).
3. **Manage Admins**: Using `PATCH /admin/users/:id/admin` to promote other users.

> [!IMPORTANT]
> Always ensure you are logged in as an admin (the `AdminGuard` will check the `isAdmin` flag on your user record) before calling these endpoints.
