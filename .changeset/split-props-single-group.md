---
'@bamboocss/shared': patch
---

Give `splitProps` a path for the shape it is actually called with.

Every call site in the project passes one array group — a recipe's `variantKeys` — and it runs per component per render,
inside `splitVariantProps`. The general implementation is built for several groups that may be predicates, and paid for
that shape on every call: a closure per group, a `map` and a `concat` to assemble the result, and a branch per group to
tell an array from a predicate. None of it is reachable with one array group.

How much this wins depends on what the framework hands over, so both ends are worth naming:

| props                      | before    | after |                     |
| -------------------------- | --------- | ----- | ------------------- |
| plain data, 2 variant keys | 650ns     | 395ns | −39%                |
| plain data, 8 variant keys | 709ns     | 440ns | −38%                |
| a non-enumerable key       | 915ns     | 662ns | −28%                |
| accessors or a proxy       | 2.3–4.9µs |       | ~0–9%, within noise |

Plain objects are what React and Vue pass. Solid passes a `mergeProps` proxy, where a trap per key dominates everything
around it — the saving is real there but small, because trap cost is not what this path skips. The general path is
unchanged to within its control (+0.0%).

Worth saying what it does _not_ skip, because both look skippable and neither is:

- The `own` set stays. Membership has to be answered from `ownKeys` rather than by asking the object: on a proxy — which
  is what Solid's `mergeProps` hands over — every question is a trap, and a recipe naming eight variants would otherwise
  fire eight traps to learn what one `ownKeys` already said.
- The two passes stay separate. The group bucket is in _group_ order and the rest bucket in _props_ order, and that
  ordering reaches the emitted CSS.

Skipping either is where the bigger numbers come from, and both change behaviour. Reading `props[key]` instead of its
descriptor is faster still and is the change that broke Solid once already.

The per-key descriptor rules are now one function shared by both paths, rather than two copies to keep in step, and a
differential test pins the two paths against each other over the shapes that distinguish them.
