# Creative Studio — Truth-Safe Reusable Components

## Purpose

Reusable components are composition primitives, not campaign-content templates.

The library exists to reuse layout structure, native typography styling and shape treatment without allowing facts, product imagery, prices, offers or other campaign-specific content to leak from one confirmed task into another.

## Safety boundary

A reusable component is scoped to one `clientId + brandId`.

Version 1 admits only:

- native text-layer style/geometry slots
- native shape layers
- group composition structure

Version 1 rejects:

- image layers
- logos
- backgrounds
- masks
- nested groups
- locked children
- children participating in mask semantics

This means the reusable-component store cannot become an alternate asset library or a way to carry stale product imagery between campaigns.

## Source-content stripping

When a group is saved as a reusable component:

1. source text payloads are not persisted;
2. source layer display names are replaced with semantic template labels;
3. text roles are retained (`headline`, `supporting`, `cta`, `price`, `body`, `disclaimer`, `brand-identifier`);
4. typography/style/geometry are retained;
5. shape geometry/style are retained;
6. detected confirmed-truth dependencies are recorded as truth keys;
7. source campaign/truth/design provenance is retained for audit only.

A component therefore stores style and structure, not publishable campaign copy.

## Truth dependency detection

`price` text slots always require confirmed destination `price` truth.

For all text roles, scalar values found in the source confirmed task snapshot are detected inside source text before the text is stripped. Matching fact keys are recorded in `requiredTruthKeys`.

Examples can include:

- `productName`
- `price`
- `offerTerms`
- `offerValidity`
- branch/contact/address values
- campaign dates
- other task-confirmed scalar facts that are visibly present

The component does not retain those source values.

## Destination insertion

Insertion requires:

- exact client match;
- exact brand match;
- destination DesignDocument bound to the destination confirmed task snapshot;
- valid confirmation provenance;
- every recorded `requiredTruthKey` present in destination task truth;
- exactly one native destination text layer for each text role used by the component.

Text is reconstructed from the destination design's native role layer. The source campaign's text is never reused.

For example, a component saved from:

```text
headline → Chicken Tikka Wrap
price → Rs. 1,250
```

can be inserted into another confirmed campaign only if that destination has the required truth and native text roles. The inserted component receives the destination campaign's current headline and price text, not `Chicken Tikka Wrap` or `Rs. 1,250`.

## Cross-format behavior

Component geometry is stored relative to its source group and source artboard.

On insertion:

- a uniform scale derives from source vs destination artboard size;
- relative typography and shape metrics scale with the block;
- the source group's relative artboard position is reused;
- the block is translated back inside the destination artboard if necessary;
- protected stacking structure remains above/below the editable tier as before.

The component does not change the destination layout provider or artboard semantics.

## Provenance

Every inserted child and group carries:

```text
componentInstance.componentId
componentInstance.instanceId
componentInstance.templateLayerId
```

This metadata is audit provenance only. It does not drive factual content or renderer truth.

## Persistence

Components are stored under:

```text
.atthas-os/components/<clientId>/<brandId>/<componentId>.json
```

Entries are immutable. Reusing the same component ID does not overwrite an existing library object.

## Studio routes

```text
GET  /api/studio/components?designId=<designId>
POST /api/studio/components/create
POST /api/studio/components/instantiate
```

Create and instantiate routes resolve the campaign's immutable task truth from the existing AI trace. Instantiation saves exactly one new DesignDocument version and reruns deterministic QA.

## UI

The `/studio` Arrange panel exposes:

- Save Selected Group
- reusable-block selector
- Insert Block
- Refresh Library

The UI displays detected required truth keys. Server-side validation remains authoritative even if the browser is bypassed.

## Cost model

Saving, listing and inserting reusable components are deterministic operations and add **zero AI/model calls**.

## Non-goals for this phase

This is intentionally not yet:

- a cross-brand template marketplace;
- a cross-client component system;
- a reusable product-image library;
- a way to save factual copy as a template;
- nested components;
- live linked/master components that mutate existing instances after library edits.

Those features require additional provenance and governance and must not be implemented by weakening destination truth checks.
