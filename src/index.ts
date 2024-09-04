const M = 32 // power of 2
const BIT_WIDTH = Math.log2(M) // 5
const E_MAX = 2 // even

export type Rrb<T> = {
  count: number
  root: Node<T>
}

export type Node<T> = Branch<T> | Leaf<T>

export type Branch<T> = {
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

const Node = <T>(height: number, items: Node<T>[] | T[]): Node<T> =>
  height === 0 ? Leaf(items as T[]) : Branch(height, items as Node<T>[])

const Leaf = <T>(items: T[]): Leaf<T> => ({
  type: "leaf",
  height: 0,
  items: items,
})

const Branch = <T>(height: number, items: Node<T>[]): Branch<T> => ({
  type: "branch",
  height,
  items: items,
  sizes: calcSizes(items),
})

const isLeaf = <T>(node: Node<T>): node is Leaf<T> => node.type === "leaf"
const isBranch = <T>(node: Node<T>): node is Branch<T> => node.type === "branch"

function assert(predicate: boolean): asserts predicate {
  if (!predicate) throw Error("Assertion failed")
}

export const initRrb = <T>(): Rrb<T> => ({
  count: 0,
  root: { type: "leaf", height: 0, items: [] },
})

export const append = <T>(xs: Rrb<T>, x: T): Rrb<T> => {
  const appended = appendToNode(xs.root, x)
  if (appended) {
    return {
      count: xs.count + 1,
      root: appended,
    }
  } else {
    const grown = Branch(xs.root.height + 1, [xs.root])
    const appended = appendToNode(grown, x)
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
const appendToNode = <T>(xs: Node<T>, x: T): Node<T> | null => {
  if (isLeaf(xs)) {
    return xs.items.length === M ? null : { ...xs, items: [...xs.items, x] }
  }

  const updated = appendToNode(
    xs.items[xs.items.length - 1],
    x
  ) as Branch<T> | null
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

/**
 * Find the element at position `idx`, or null if the index is out of bounds.
 */
export const get = <T>(rrb: Rrb<T>, idx: number): T | null => {
  if (idx >= rrb.count) return null
  return findElement(rrb.root, idx)
}

const findElement = <T>(node: Node<T>, idx: number): T => {
  if (isBranch(node)) {
    // find the slot containing our element
    const slot = findSlot(idx, node.height, node.sizes)
    // find the number of elements in the preceding slots
    const prevSize = slot === 0 ? 0 : node.sizes[slot - 1]
    // calculate the index within our slot
    const nextIdx = idx - prevSize
    // recurse
    return findElement(node.items[slot], nextIdx)
  } else {
    // fallback to array indexing for leaf nodes
    return node.items[idx]
  }
}

const findSlot = (idx: number, height: number, sizes: number[]): number => {
  // find starting slot by radix indexing
  let slot = idx >> (BIT_WIDTH * height)
  // skip slots until we reach the first with a cumulative size greater than
  // our index - this is where our element will be
  while (sizes[slot] <= idx) slot++
  return slot
}

/**
 * Concatenate two RRB trees into a single balanced RRB tree.
 */
export const concat = <T>(left: Rrb<T>, right: Rrb<T>): Rrb<T> => {
  // create a single, balanced node containing all items from left and right
  const merged = concatNodes(left.root, right.root)
  return {
    count: left.count + right.count,
    root:
      // there may be a redundant extra level so we chop it off if necessary
      merged.items.length === 1 ? merged.items[0] : merged,
  }
}

/**
 * Concatenate two nodes into a single balanced branch.
 *
 * Since we always return a branch, but there may be M or fewer items, the
 * branch may be redundant and can be unwrapped by the caller.
 */
const concatNodes = <T>(left: Node<T>, right: Node<T>): Branch<T> => {
  // first, we handle trees of different heights

  if (left.height > right.height) {
    assert(isBranch(left))
    const middle = concatNodes(last(left.items), right)
    return rebalance(left, middle, null)
  }

  if (left.height < right.height) {
    assert(isBranch(right))
    const middle = concatNodes(left, first(right.items))
    return rebalance(null, middle, right)
  }

  // then, we handle leaf nodes

  if (isLeaf(left) && isLeaf(right)) {
    return Branch(1, [left, right])
  }

  // finally, we handle branches of equal height

  if (isBranch(left) && isBranch(right)) {
    const middle = concatNodes(last(left.items), first(right.items))
    return rebalance(left, middle, right)
  }

  throw Error("unreachable")
}

const calcSizes = <T>(items: Node<T>[]): number[] => {
  let prev = 0
  return items.map(item => (prev += sizeOf(item)))
}

/**
 * Create a single, balanced branch containing
 * all items from the input branches.
 */
const rebalance = <T>(
  left: Branch<T> | null,
  middle: Branch<T>,
  right: Branch<T> | null
): Branch<T> => {
  // merge into a single, unbalanced node that may contain up to 2M items
  const merged = Branch(middle.height, [
    ...(left ? init(left.items) : []),
    ...middle.items,
    ...(right ? tail(right.items) : []),
  ])
  // create a plan of how the items should be balanced
  const plan = createConcatPlan(merged)
  // create a single, balanced node that may contain up to 2M items
  const balanced = executeConcatPlan(merged, plan)

  if (plan.length <= M) {
    return Branch(balanced.height + 1, [balanced])
  } else {
    // distribute the (up to 2M) items across 2 nodes in a new branch
    const left = Branch(balanced.height, balanced.items.slice(0, M))
    const right = Branch(balanced.height, balanced.items.slice(M))
    return Branch(balanced.height + 1, [left, right])
  }
}

/**
 * Generate a plan of how the items in `node` should be
 * distributed that conforms to the search step invariant.
 */
const createConcatPlan = <T>(node: Branch<T>): number[] => {
  // our initial plan is the current distribution of items
  const plan = node.items.map(sizeOf)
  // count the total number of items
  const s = plan.reduce((a, b) => a + b)
  // calculate the optimal number of slots necessary
  const opt = Math.ceil(s / M)

  let i = 0
  let n = plan.length
  // check if our invariant is met
  while (n > opt + E_MAX) {
    // skip slots that don't need redistributing
    while (plan[i] >= M - E_MAX / 2) i++

    // current slot needs distributing over its subsequent siblings

    // track remaining items to distribute, which starts as all
    // the items from the current slot we're going to distribute
    let r = plan[i]
    while (r > 0) {
      // replace the items in the current slot with all the items from the next
      // slot, plus as many remaining items we have to distribute as possible
      plan[i] = Math.min(r + plan[i + 1], M)
      // calculate the items remaining
      r = r + plan[i + 1] - plan[i]
      i += 1
    }

    // slots that were distributed over were shuffled one slot to the left so
    // we need to do the same for any remaining slots
    for (let j = i; j < n - 1; j++) {
      plan[j] = plan[j + 1]
    }

    // account for shuffling slots to the left
    i--
    n--
  }

  return plan.slice(0, n)
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
    if (offset === 0 && sizeOf(node.items[i]) === target) {
      items.push(node.items[i])
      i += 1
    } else {
      const current: Node<T>[] | T[] = []
      while (current.length < target) {
        const required = target - current.length
        const size = sizeOf(node.items[i])
        const available = size - offset
        const min = Math.min(required, available)
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
      items.push(Node(node.height - 1, current))
    }
  })

  return Branch(node.height, items)
}

const sizeOf = <T>(tree: Node<T>): number => {
  if (isLeaf(tree)) return tree.items.length
  return tree.sizes[tree.sizes.length - 1]
}

const first = <T>(arr: T[]): T => arr[0]
const last = <T>(arr: T[]): T => arr[arr.length - 1]
const init = <T>(arr: T[]): T[] => arr.slice(0, -1)
const tail = <T>(arr: T[]): T[] => arr.slice(1)
