# ATTHA’S Marketing Manager Workspace

## Purpose

The Marketing Manager workspace is the local user-facing shell over the governed ATTHA’S Creative OS V1 engine.

It is designed for a user who should be able to describe a business need in ordinary language, review what Creative OS understood, confirm every task-relevant fact, and then run the existing production pipeline without touching JSON, prompts or CLI orchestration internals.

The workspace does **not** weaken the task-truth rules added in the confirmation gateway.

> Stored truth is memory. Every customer-facing fact required by a new task must still be confirmed before production.

## Start the workspace

```bash
npm install
export GEMINI_API_KEY="..."
npm run marketing:workspace
```

The default local address is:

```text
http://127.0.0.1:4174/workspace
```

Use `ATTHAS_WORKSPACE_PORT` to choose another port.

Local operating data is written under `.atthas-os/`, which is gitignored.

AI image generation remains opt-in:

```bash
export ALLOW_PAID_MEDIA=true
```

Without that flag the user must provide a governed local upload when production needs a base image. Text generation still requires `GEMINI_API_KEY` when the user actually clicks Produce.

## User workflow

### 1. Describe the business need

Example:

```text
Get more customers to Wellampitiya tonight with a strong Instagram post.
```

The local interpreter conservatively proposes:

- operating brand
- branch
- campaign type
- platform
- asset type
- product/item when clearly supplied
- whether a price was explicitly requested
- price sales channel when clearly supplied

The interpretation is only a proposal. The user reviews and can change the structured task before the truth questionnaire is created.

### 2. Review the task

The user confirms or edits:

- ATTHA’S Burger vs ATTHA’S Restaurant
- exact branch or brand-wide scope where the campaign type permits it
- campaign type
- platform and format
- product/item name for product campaigns
- whether a price should appear
- dine-in / takeaway / Uber Eats / PickMe scope for price-bearing work
- draft vs final production mode

Canonical active V1 branch IDs come directly from the owner-confirmed branch master:

- `BURGER_WELLAMPITIYA`
- `BURGER_MARINE_DRIVE_C04` — Bambalapitiya
- `BURGER_HEY_MARINE_C03` — Kollupitiya
- `RESTAURANT_COLOMBO_06` — Wellawatte

### 3. Confirm task truth

The workspace calls the existing task confirmation layer. Each required fact becomes one of:

- `CONFIRM_STORED`
- `PROVIDE_MISSING`
- `RESOLVE_CONFLICT`

A stored value is never silently reused.

For example, a Wellampitiya dine-in campaign can show the stored address and physical hours, but the user still has to confirm them for the current task.

A product/price campaign keeps branch, product and sales-channel scope attached to every relevant requirement.

### 4. Optional governed write-back

When the user corrects or supplies a value, the confirmation form offers a separate choice to save it to local truth memory.

Requested write-backs are stored at:

```text
.atthas-os/truth/runtime.json
```

Runtime truth uses exact key/scope identity:

```text
tenant + brand + branch + product + sales channel + fact key
```

A corrected Wellampitiya dine-in price therefore cannot overwrite the same product’s Bambalapitiya, Kollupitiya, Uber Eats or PickMe price.

A write-back only improves what the next questionnaire remembers. It never removes the requirement to reconfirm that value on the next customer-facing task.

### 5. Choose visual input

The workspace supports a governed local PNG/JPEG/WebP upload. Uploads are stored under:

```text
.atthas-os/uploads/<task-session>/
```

Files are size/type checked and production only accepts base-image paths from that governed upload area.

If no local image is supplied, AI image generation requires `ALLOW_PAID_MEDIA=true`.

### 6. Produce

The workspace calls `runConfirmedCampaignTask(...)`, not the lower-level production primitive directly.

The production path remains:

```text
task snapshot
  -> fact gate
  -> campaign generation
  -> Creative Director
  -> layout selection
  -> visual generation/input
  -> visual QA when FINAL
  -> deterministic poster rendering
  -> final-art QA when FINAL
```

FINAL mode therefore keeps both image-level and finished-artwork quality gates.

### 7. Review the result

The workspace shows:

- generated concept cards
- the recommended Creative Director concept
- production status
- rendered poster preview when successful
- campaign/task-truth identity

Rendered campaigns are also written into the existing operations store with poster asset metadata, a revision record and tracked image-attempt spend where available.

## Workspace API

The local V1 server exposes:

```text
GET  /workspace
GET  /health
GET  /api/ui/bootstrap
GET  /api/ui/truth
POST /api/ui/interpret
POST /api/ui/prepare
POST /api/ui/confirm
POST /api/ui/upload
POST /api/ui/produce
GET  /media/:campaignId/:filename
```

The server is deliberately bound to `127.0.0.1` by the launcher. It is an internal/local V1 interface, not a hardened public SaaS endpoint.

## Safety properties

- Natural-language interpretation cannot bypass explicit task review.
- Customer-facing operational facts are not silently reused.
- Price-bearing work requires an explicit sales channel.
- Product/dine-in/delivery/offer campaigns require a safe branch scope.
- Canonical branch IDs match the owner-confirmed master.
- Runtime corrections are exact-scope overlays only.
- The final production call requires the immutable task snapshot.
- Paid image generation remains explicit opt-in.
- Uploaded media is limited to a governed local area.
- Final mode retains visual QA and final-art QA.
- Private runtime data remains outside the public repository under `.atthas-os/`.

## Current V1 limitations

The workspace is intentionally a local operating UI rather than a finished multi-user SaaS product.

Still outside this PR:

- login / production RBAC
- a full product/photo asset library
- polished visual revision controls
- interactive approval-transition controls
- visual content calendar
- automatic social publishing
- production database/object storage migration
- final approved ATTHA’S wordmark and operating-brand lockups
- real-world validation across 20–30 ATTHA’S campaigns

Those should be driven by production validation rather than expanding the UI speculatively.
