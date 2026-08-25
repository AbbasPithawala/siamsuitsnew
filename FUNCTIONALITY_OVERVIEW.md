# Siam Suits — How It Currently Works

*A walkthrough of what the system does today, module by module. Not a wishlist — just the current behavior, as understood from the code. Add notes/corrections inline wherever something's missing, wrong, or needs more nuance.*

---

## The cast of characters

Three kinds of people use this system:

- **Admin / staff** — the back office. They manage the product catalog, take/process orders, run the factory floor, and handle invoicing and shipping.
- **Retailers** — storefronts (or the retailer's own staff) who take customer orders on the front end: measurements, fabric, styling, and payment.
- **Tailors** — factory workers who actually cut, sew, and finish the garments. They don't have a real app of their own (more on that below); admins operate on their behalf.

Everyone logs in through one shared login screen. The server checks the submitted username/password against both the Admin and Retailer collections (tailors log in separately, through their own endpoint). Whoever the system finds back determines which of two app shells you land in — the retailer shell, or the staff/admin shell — and, for staff, which menu items you see depends on the "modules" your assigned role is allowed.

---

## Setting up the catalog (Admin)

Before any order can be placed, the admin has to define what's sellable. This lives under the admin side of the app:

- **Products (the real, atomic garments)** — a Product record is a single physical piece: Jacket, Pant, Tuxedo Jacket, and potentially others like Shirt, Overcoat, Long Jacket. Each one is defined independently, with its own set of features/style options, its own measurement points, and its own manufacturing processes. This is the actual catalog layer, and it's already built to hold any number of distinct garment types — nothing in the `Product` model itself limits it to just these two examples.
- **"Suit" and "Tuxedo" are not products in the database at all.** They're a hardcoded concept living entirely in the order-creation code: when an order item is literally named `"suit"`, the server internally expands it into two lookups against the real Product catalog — Product `"jacket"` + Product `"pant"`. When it's `"tuxedo"`, it expands into Product `"tuxedojacket"` + Product `"pant"`. This pairing (which two products make up a "super product," and that there are only two such super products) is baked into `if/else` branches in the order code — there's no table anywhere that says "a Suit consists of these products." A base product like Shirt or Overcoat can exist in the catalog and still be completely unreachable through ordering, because nothing bundles it into a super product the way jacket+pant are bundled for Suit.
- **Processes** — the manufacturing steps a garment goes through (cutting, stitching, pressing, button work, etc.), each with a price. Processes are attached to products by name — there's no strict database link, just string matching.
- **Features & Styles** — the customizable style choices for a garment (lapel type, pocket style, vents, buttons, etc.), each with its own set of selectable options, images, and pricing (including a separate worker/piece-rate price). Every Feature belongs to exactly one Product — there's no way for a Feature to be shared/reused across several products. If two different garments genuinely need "the same" style choice, today that means two separate, independently-configured Feature records, one per product, with no link between them.
- **Measurements** — the named measurement points (chest, sleeve, waist, etc.) used to size a garment, each with an English and Thai label.
- **Piping** — a separate, standalone catalog of trim/piping choices (code, supplier, image). Unlike Features, it isn't scoped to any particular product at all — it's a flat global list, not something explicitly marked "available on these products."
- **Fabric, Lining, and Monogram are not catalog-driven at all**, unlike everything above. Fabric and Lining are just free-text fields the retailer fills in fresh at order time — the same input, copy-pasted across each garment-type section of the styling screen, not pulled from any shared list. Monogram is its own hardcoded piece of UI (fixed font-style images, side/color pickers) bolted on separately from the Feature/Style system, and it's duplicated per garment type rather than shared. So today there's no real concept anywhere of "this style element applies to this specific subset of products" — each of these four is handled by a different, ad hoc mechanism.
- **Retailer pricing** — retailers can be given their own price overrides on top of the base catalog.
- **Roles** — an admin can create named roles and pick which menu "modules" (Manage Roles, New Order, Create Invoice, etc.) that role can see. This currently only controls what's *visible* in the sidebar — it doesn't restrict what a logged-in user can actually call on the backend.

Retailer accounts themselves are also managed here: creating a retailer, giving them a retailer code, and toggling them active/inactive (an inactive retailer can't log in).

---

## A retailer's day: taking an order

This is the heart of the app, and it happens on the retailer side (or the admin side, which has its own near-identical order flow for staff-placed orders).

**Customers.** A retailer first creates a customer record — name, contact info, photo. A customer can have measurements and style choices saved against them so repeat orders are fast.

**Measurements.** For whichever product the customer is ordering (Suit or Tuxedo), the retailer fills in a full body measurement form — separate forms exist for suits and tuxedos, since the fields differ. There's also a "manual size" path for entering sizes directly rather than full measurements, and a "draft" mechanism that lets a partially-filled measurement session be saved and resumed later before it's finalized against a customer.

**Fabric and styling.** This is the big, complex step — choosing the fabric, and then walking through every customizable feature of the garment (lapel, pockets, vents, buttons, lining, monogram initials and placement, piping, and more). Because "Suit" and "Tuxedo" are really two underlying products bundled together, this step is effectively done twice per order item — once for the jacket (or tuxedo jacket), once for the pant — each pulling its own feature/style list from its own Product record. Every choice affects both the price shown to the retailer and a separate "worker price" used later to pay the tailor for that specific piece of work.

**Placing the order.** Once measurements and styling are set, the order is created. At creation time, the server also builds a hidden tracking structure behind the scenes — for every physical piece being made (the jacket, the pant, etc. — the real underlying products, not "the Suit" as a whole), it lists out every manufacturing process that piece needs to go through, each starting as "not yet started." This is what the factory floor works against later, and it's also why manufacturing tracking is naturally per-garment-piece already, even though ordering only exposes two fixed bundles of pieces today.

**Group orders.** For bulk orders — think a wedding party with several people needing suits under one umbrella — there's a separate "group order" flow. A retailer adds multiple customers, each with their own measurements and styling, under one group. Behind the scenes, the group order actually spins off an ordinary individual order for each customer, so each person's garments flow through the same manufacturing pipeline as a normal order.

**Editing, repeating, searching.** Orders can be edited after the fact, repeated (re-order the same specs for the same customer), rush-flagged, and searched/filtered by retailer staff.

---

## Turning an order into a garment: the factory floor

Once an order exists, it needs to be manufactured. This is run from the admin side's Factory section.

**Tailors** are the workers. Each tailor is certified for a specific set of processes (e.g., someone certified for stitching can't be assigned a cutting job). An admin manages the tailor roster — adding tailors, assigning which processes they're allowed to do.

**Assigning work.** An admin operates an "Assign Item" screen: they pick a tailor, then either type or camera-scan a QR code that identifies a specific order item. The system looks at that item's tracking structure, finds the next process in line that hasn't been started yet, checks that the selected tailor is certified for it, and marks it as assigned to that tailor. A job record is created capturing what it should pay.

**Completing work.** From the same screen, once a job is done, the admin can mark it complete and print a job ticket — a small thermal-printer-sized slip with a QR code (this one encoding the job's own ID) that serves as a physical record/audit trail for that piece of work. If the process qualifies for a piece-rate bonus (stitching-related extras), the admin can add that bonus at the same time.

**Extra payments.** On top of the standard price for a process, an admin can define "Extra Payment Categories" ahead of time, and each one is tied to a specific combination: which Product it applies to, which style Feature and specific style choice under it, which manufacturing Process it's paid during, and a cost. So a category is meant to represent something like "if this particular style choice was made on this product, pay a bonus when the stitching process is done for it."

In practice, that specificity is only half-enforced. When an admin completes a job on the Assign Item screen and opens "Add Extra Payment," the categories offered as checkboxes are filtered by matching the item's product and the job's current process only — the system doesn't check whether the order actually had that category's specific style/feature chosen. It's shown as an option any time the product and process line up, and the admin decides by judgement whether to check it. Once selected, the payment gets saved as-is with no server-side re-check that the process (or styling) genuinely matches. Separately, whether an extra payment needs admin approval before it counts toward pay depends on which screen created it — ones added manually through the Payment Categories admin flow default to needing approval; ones added during job completion don't.

**Paying tailors.** A separate "Payment Summary" screen lets an admin pick a tailor, see their unpaid completed jobs, select which ones to settle, deduct any outstanding cash advance the tailor has taken, add a manual rent/bill deduction if needed, and record the final settlement. Advances themselves are tracked as their own running balance per tailor, adjustable independently.

**Shipping-box barcoding** — a separate factory-floor screen — exists for tracking work but doesn't currently do anything (it's present in the navigation without functioning logic behind it), noted here since it looks operational from the menu.

---

## Invoicing

Once an order (or a batch of them) is ready to bill, staff generate an invoice for the retailer — line items, pricing, discounts, and shipping charges — which can be tracked through a history and marked paid. Retailers can view their own invoice history on their side of the app.

---

## Getting it out the door: shipping

Finished orders get packed into shipping boxes. A staff member scans (or enters) order/item codes to add them into a box, gets a tracking code for the box, and closes it out once full. Scanning an item into a box, or scanning an order directly, is also what flips that order's status forward toward "Shipment" / "Sent" — this status change happens independently of whether every manufacturing step for that order is actually finished.

---

## Behind the scenes

- **Images** — product photos, fabric/style reference images, and customer photos are uploaded through a shared upload endpoint, stored briefly on the server, then pushed up to cloud storage (S3) for permanent hosting.
- **PDFs** — two separate things get turned into PDFs, generated completely differently:
  - The **factory job ticket** (small thermal-slip, printed per process) — covered above.
  - The **order paperwork PDF**, generated on demand (typically right after an order is placed/finalized) by the client handing the server everything it needs — the order, the retailer, the full item list, and the per-item styling/measurement detail — as one big request. The server assembles this into a raw HTML document (built as one long string, no templating engine) and renders it to an actual PDF using a headless Chromium browser (Puppeteer). The document has, per order: a cover section per batch of items (customer name, order date, gender, a reference to the customer's previous order, and callouts if this order is Modified/Rush/Repeat, plus the order's own QR code and the retailer's logo); a table listing every physical piece in the order (jacket, pant, etc., with jacket+pant shown as a merged block for Suit/Tuxedo) each with its fabric code and its own QR code — and that QR code encodes the exact same `orderId/itemKey` string the factory floor's Assign Item screen scans, so this document doubles as the source of the garment tags used in production; and then a full detail page per item: the entire measurement table (each point in English and Thai, with the raw value, any adjustment, and the computed total — and if the order was built from a saved draft measurement, any value that changed from the draft is called out), fitting notes, a shoulder/pant-type reference silhouette image, a Lining section, a Monogram section, and the customer's photo. Once rendered, the PDF is saved locally then immediately pushed to S3, and the order record is updated with that file path. A separate endpoint just polls S3 to check whether the upload finished.
- **Email** — a simpler, separate flow re-fetches the order and sends a short summary email (retailer name, customer name, order number) with that PDF attached, to whatever recipient list is configured on the retailer's account — via a hardcoded Gmail account, not a transactional email service. The local PDF copy is deleted right after sending (the S3 copy remains). Invoices follow a similar emailing pattern.

---

## What's *not* really working today (noted for completeness, not as a to-do)

A few things exist in the UI/navigation but don't actually function: the standalone "worker barcoding" screen, and a "Payment Detail" screen separate from the working "Payment Summary" one. Group orders' factory-floor tracking (assigning/completing jobs specifically through the "this is a group order" code path) also doesn't work in practice — group order items end up being processed through the same path as ordinary individual orders instead, which is why things still function for the retailer/customer-facing side of group orders even though the dedicated group logic underneath is dead.

---

*Add your notes below or inline above — anything I've got wrong, oversimplified, or left out entirely.*
