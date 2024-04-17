const M = 32 // must be power of 2
const BIT_WIDTH = Math.log2(M)
const E_MAX = 2 // must be even

export type Rrb<T> = {
  count: number
  root: Node<T>
}

export type Node<T> = Branch<T> | Leaf<T>

type Branch<T> = {
  type: "branch"
  height: number // >= 1
  sizes: number[]
  items: Node<T>[]
}

export type Leaf<T> = {
  type: "leaf"
  height: 0
  items: T[]
}

function assert(predicate: boolean): asserts predicate {
  if (!predicate) throw Error("Assertion failed")
}

export const init = <T>(): Rrb<T> => ({
  count: 0,
  root: { type: "leaf", height: 0, items: [] },
})

export const append = <T>(xs: Rrb<T>, x: T): Rrb<T> => {
  const appended = _append(xs.root, x)
  if (appended) {
    return {
      count: xs.count + 1,
      root: appended,
    }
  } else {
    const grown = grow(xs.root)
    const appended = _append(grown, x)
    if (!appended) throw Error("unreachable")
    return {
      count: xs.count + 1,
      root: appended,
    }
  }
}

/**
 * Append `x` to `xs`. Returns null if there is no space.
 */
const _append = <T>(xs: Node<T>, x: T): Node<T> | null => {
  if (xs.type === "leaf") {
    return xs.items.length === M ? null : { ...xs, items: [...xs.items, x] }
  }

  const updated = _append(xs.items[xs.items.length - 1], x) as Branch<T> | null
  if (updated) {
    const items = [...xs.items.slice(0, -1), updated]
    return {
      type: "branch",
      height: xs.height,
      sizes: calcSizes(items),
      items,
    }
  } else if (xs.items.length < M) {
    const items = [...xs.items, treeOfHeight(xs.height - 1, x)]
    return {
      type: "branch",
      height: xs.height,
      sizes: calcSizes(items),
      items,
    }
  } else {
    return null
  }
}

/**
 * Create a tree of `height` with a single element, `x`.
 */
const treeOfHeight = <T>(height: number, x: T): Node<T> =>
  height === 0
    ? { type: "leaf", height, items: [x] }
    : {
        type: "branch",
        height,
        sizes: [1],
        items: [treeOfHeight(height - 1, x)],
      }

export const get = <T>(xs: Rrb<T>, idx: number): T | null => {
  if (idx >= xs.count) return null
  return getItem(xs.root, idx)
}

const getItem = <T>(node: Node<T>, key: number): T => {
  if (node.type === "leaf") {
    return node.items[key]
  } else {
    const idx = findIndex(key, node.height, node.sizes)
    const prevSize = idx === 0 ? 0 : node.sizes[idx - 1]
    const nextKey = key - prevSize
    return getItem(node.items[idx], nextKey)
  }
}

const findIndex = (key: number, height: number, sizes: number[]) => {
  let idx = key >> (BIT_WIDTH * height)
  for (idx; idx < sizes.length; idx++) {
    if (key < sizes[idx]) return idx
  }
  throw Error("Could not find index in sizes")
}

export const concat = <T>(left: Rrb<T>, right: Rrb<T>): Rrb<T> => {
  const merged = _concat(left.root, right.root)
  // chop off any excess levels
  const shrunk = shrink(merged)
  return {
    count: sizeOf(shrunk),
    root: shrunk,
  }
}

const _concat = <T>(
  left: Node<T>,
  right: Node<T>,
  top: boolean = true
): Branch<T> => {
  if (left.height > right.height) {
    assert(left.type === "branch")
    const middle = _concat(last(left.items as Node<T>[]), right, false)
    return rebalance(left, middle, null, top)
  }

  if (left.height < right.height) {
    assert(right.type === "branch")
    const middle = _concat(left, first(right.items as Node<T>[]), false)
    return rebalance(null, middle, right, top)
  }

  if (left.type === "leaf" && right.type === "leaf") {
    const total = left.items.length + right.items.length
    if (top && total <= M) {
      return {
        type: "branch",
        height: 1,
        sizes: [total],
        items: [
          { type: "leaf", height: 0, items: [...left.items, ...right.items] },
        ],
      }
    } else {
      // We don't need to balance since the outer recursive
      // step will rebalance them later.
      return {
        type: "branch",
        height: 1,
        sizes: [left.items.length, right.items.length],
        items: [left, right],
      }
    }
  } else {
    assert(left.type === "branch")
    assert(right.type === "branch")

    const middle = _concat(last(left.items), first(right.items), false)
    return rebalance(left, middle, right, top)
  }
}

const calcSizes = <T>(items: Node<T>[]): number[] => {
  let prev = 0
  return items.map(item => (prev += sizeOf(item)))
}

const rebalance = <T>(
  left: Branch<T> | null,
  middle: Branch<T>,
  right: Branch<T> | null,
  top: boolean
): Branch<T> => {
  const merged = merge(left, middle, right)
  const plan = createConcatPlan(merged)
  const balanced = executeConcatPlan(merged, plan)

  if (plan.length <= M) {
    return top
      ? balanced
      : (toNode([balanced], balanced.height + 1) as Branch<T>)
  } else {
    const left: Branch<T> = {
      type: "branch",
      height: balanced.height,
      sizes: balanced.sizes.slice(0, M),
      items: balanced.items.slice(0, M),
    }
    const leftCml = sizeOf(left)
    const right: Branch<T> = {
      type: "branch",
      height: balanced.height,
      sizes: balanced.sizes.slice(M).map(x => x - leftCml),
      items: balanced.items.slice(M),
    }
    return toNode([left, right], balanced.height + 1) as Branch<T>
  }
}

const createConcatPlan = <T>(node: Branch<T>): number[] => {
  const plan = node.items.map(sizeOf)
  const s = plan.reduce((a, b) => a + b)
  const opt = Math.ceil(s / M)

  let n = plan.length
  let i = 0
  while (opt + E_MAX < n) {
    // skip slots that don't need redistributing
    while (plan[i] >= M - E_MAX / 2) {
      i += 1
    }

    // distribute slot over following siblings
    let r = plan[i]
    while (r > 0) {
      plan[i] = Math.min(r + plan[i + 1], M)
      r = r + plan[i + 1] - plan[i]
      i += 1
    }

    // distribution has shuffled siblings one slot to the left
    // but we still need to do the same for any remaining sibilngs
    for (let j = i; j < n; j++) {
      plan[i] = plan[i + 1]
    }

    // since we shifted everything left we need to check the current
    // slot again to see if it needs distributing
    i -= 1

    // account for the slot that we have removed
    n -= 1
  }

  return plan
}

/*
 * Distribute the items in `node` according to `plan`. Both the input and
 * output may have more than M items which will be handled in `rebalance`.
 */
const executeConcatPlan = <T>(node: Branch<T>, plan: number[]): Branch<T> => {
  const items: Node<T>[] = []

  let i = 0
  let offset = 0
  plan.forEach(target => {
    if (offset === 0 && sizeOfSlot(node, i) === target) {
      items.push(node.items[i])
      i += 1
    } else {
      const current: Node<T>[] | T[] = []
      while (current.length < target) {
        const size = sizeOfSlot(node, i)
        const available = size - offset
        const min = Math.min(target, available)
        current.push(
          ...(node.items[i].items.slice(offset, min + offset) as any)
        )
        if (min === available) {
          offset = 0
          i += 1
        } else {
          offset += min
        }
      }
      items.push(toNode(current, node.height - 1) as any)
    }
  })

  return toNode(items, node.height) as Branch<T>
}

const sizeOfSlot = <T>(node: Branch<T>, i: number): number =>
  node.sizes[i] - (i > 0 ? node.sizes[i - 1] : 0)

/*
 * Create a new node containing [init(left), middle, tail(right)] items. May
 * contain more than M items.
 */
const merge = <T>(
  left: Branch<T> | null,
  middle: Branch<T>,
  right: Branch<T> | null
): Branch<T> => {
  const items: Node<T>[] | T[] = []

  if (left) {
    // skip the last item since it has been added to `middle`
    items.push(...(left.items.slice(0, -1) as any))
  }

  items.push(...(middle.items as any))

  if (right) {
    // skip the first item since it has been added to `middle`
    items.push(...(right.items.slice(1) as any))
  }

  return toNode(items, middle.height) as Branch<T>
}

const grow = <T>(node: Node<T>): Node<T> => ({
  type: "branch",
  height: node.height + 1,
  sizes: [sizeOf(node)],
  items: [node],
})

const shrink = <T>(node: Node<T>): Node<T> =>
  node.type === "branch" && node.items.length === 1
    ? shrink(node.items[0])
    : node

const sizeOf = <T>(tree: Node<T>): number => {
  if (tree.type === "leaf") return tree.items.length
  return tree.sizes[tree.sizes.length - 1]
}

const toNode = <T>(items: Node<T>[] | T[], height: number): Node<T> => {
  return height === 0
    ? { type: "leaf", height, items: items as any }
    : {
        type: "branch",
        height,
        items: items as any,
        sizes: calcSizes(items as any),
      }
}

const first = <T>(arr: T[]): T => arr[0]
const last = <T>(arr: T[]): T => arr[arr.length - 1]
