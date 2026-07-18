/**
 * What this file does:
 * Seeds a realistic demo tenant set so the app can be exercised without hand-building every record.
 * What calls it:
 * `src/app/api/seed-demo/route.ts`.
 * What it calls:
 * Prisma directly for bulk setup and `src/lib/auth/password.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Seeding only one tenant, which leaves tenant-isolation paths unexercised.
 */
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma/client";

const demoPassword = "ProcureFlow123!";

export const seedDemoService = {
  async seed() {
    const existingDemo = await prisma.organization.findUnique({
      where: { slug: "acme-industrial" },
    });

    if (existingDemo) {
      return {
        alreadySeeded: true,
        credentials: [
          { email: "olivia@acme.test", organizationSlug: "acme-industrial", password: demoPassword, role: "ORG_ADMIN" },
          { email: "marco@acme.test", organizationSlug: "acme-industrial", password: demoPassword, role: "PROCUREMENT_MANAGER" },
          { email: "erin@blueorbit.test", organizationSlug: "blue-orbit-foods", password: demoPassword, role: "ANALYST" },
        ],
      };
    }

    const passwordHash = await hashPassword(demoPassword);

    await prisma.$transaction(async (tx) => {
      const acme = await tx.organization.create({
        data: {
          name: "Acme Industrial",
          slug: "acme-industrial",
        },
      });

      const blueOrbit = await tx.organization.create({
        data: {
          name: "Blue Orbit Foods",
          slug: "blue-orbit-foods",
        },
      });

      const [olivia, marco, erin] = await Promise.all([
        tx.user.create({
          data: {
            email: "olivia@acme.test",
            name: "Olivia Grant",
            passwordHash,
            platformRole: "USER",
          },
        }),
        tx.user.create({
          data: {
            email: "marco@acme.test",
            name: "Marco Li",
            passwordHash,
            platformRole: "USER",
          },
        }),
        tx.user.create({
          data: {
            email: "erin@blueorbit.test",
            name: "Erin Shah",
            passwordHash,
            platformRole: "USER",
          },
        }),
      ]);

      await tx.membership.createMany({
        data: [
          { organizationId: acme.id, role: "ORG_ADMIN", userId: olivia.id },
          { organizationId: acme.id, role: "PROCUREMENT_MANAGER", userId: marco.id },
          { organizationId: blueOrbit.id, role: "ANALYST", userId: erin.id },
        ],
      });

      const [vendorA, vendorB] = await Promise.all([
        tx.vendor.create({
          data: {
            code: "ALPHA-001",
            contactEmail: "sales@alphametals.test",
            country: "US",
            name: "Alpha Metals",
            paymentTerms: "Net 30",
            tenantId: acme.id,
          },
        }),
        tx.vendor.create({
          data: {
            code: "BRAVO-002",
            contactEmail: "ops@bravopack.test",
            country: "CA",
            name: "Bravo Packaging",
            paymentTerms: "Net 45",
            tenantId: acme.id,
          },
        }),
      ]);

      const rfq = await tx.requestForQuote.create({
        data: {
          createdById: marco.id,
          description: "Quarterly sheet metal and packaging refresh",
          status: "OPEN",
          tenantId: acme.id,
          title: "Q2 Materials Refresh",
          lineItems: {
            create: [
              { description: "Cold rolled sheet metal", quantity: 120, targetUnitPrice: "42.50" },
              { description: "Shipping cartons", quantity: 500, targetUnitPrice: "3.10" },
            ],
          },
        },
      });

      const selectedQuote = await tx.quote.create({
        data: {
          currency: "USD",
          requestForQuoteId: rfq.id,
          status: "SELECTED",
          submittedById: marco.id,
          tenantId: acme.id,
          totalAmount: "6650.00",
          validUntil: new Date("2026-05-01T00:00:00.000Z"),
          vendorId: vendorA.id,
          lineItems: {
            create: [
              { description: "Cold rolled sheet metal", quantity: 120, unitPrice: "42.50" },
              { description: "Shipping cartons", quantity: 500, unitPrice: "3.10" },
            ],
          },
        },
      });

      await tx.purchaseOrder.create({
        data: {
          approvedAt: new Date("2026-04-02T10:00:00.000Z"),
          approvedById: olivia.id,
          currency: "USD",
          poNumber: "PO-24017",
          quoteId: selectedQuote.id,
          requestedById: marco.id,
          status: "APPROVED",
          submittedAt: new Date("2026-04-01T10:00:00.000Z"),
          tenantId: acme.id,
          totalAmount: "6650.00",
          vendorId: vendorA.id,
          lineItems: {
            create: [
              { description: "Cold rolled sheet metal", quantity: 120, unitPrice: "42.50" },
              { description: "Shipping cartons", quantity: 500, unitPrice: "3.10" },
            ],
          },
        },
      });

      await tx.reportDefinition.create({
        data: {
          createdById: olivia.id,
          description: "Approved purchasing spend by vendor",
          dimensions: ["vendor", "status"],
          filters: { minAmount: 1000 },
          metrics: ["totalSpend", "poCount"],
          name: "Approved Spend Overview",
          reportType: "PROCUREMENT_SPEND",
          tenantId: acme.id,
        },
      });

      await tx.vendor.create({
        data: {
          code: "DELTA-001",
          contactEmail: "buyers@deltafarms.test",
          country: "US",
          name: "Delta Farms Supply",
          paymentTerms: "Net 15",
          tenantId: blueOrbit.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "demo.seeded",
          actorUserId: olivia.id,
          entityId: acme.id,
          entityType: "Organization",
          metadata: { vendorIds: [vendorA.id, vendorB.id] },
          tenantId: acme.id,
        },
      });
    });

    return {
      alreadySeeded: false,
      credentials: [
        { email: "olivia@acme.test", organizationSlug: "acme-industrial", password: demoPassword, role: "ORG_ADMIN" },
        { email: "marco@acme.test", organizationSlug: "acme-industrial", password: demoPassword, role: "PROCUREMENT_MANAGER" },
        { email: "erin@blueorbit.test", organizationSlug: "blue-orbit-foods", password: demoPassword, role: "ANALYST" },
      ],
    };
  },
};

// ⚠️ SENIOR NOTE: Demo seeds should include at least two tenants and several roles; otherwise permission and isolation
// bugs can hide behind a too-friendly dataset.
