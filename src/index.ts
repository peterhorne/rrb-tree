const M = 32 // must be power of 2
const BIT_WIDTH = Math.log2(M)

export type Rrb<T> = {
  count: number
  height: number
  root: Node<T>
}

export type Node<T> = Branch<T> | Leaf<T>

type Branch<T> = {
  height: number // >= 1
  sizes: number[]
  items: Node<T>[]
}

export type Leaf<T> = {
  height: 0
  items: T[]
}

const isBranch = <T>(node: Node<T>): node is Branch<T> => node.height > 0
const isLeaf = <T>(node: Node<T>): node is Leaf<T> => node.height === 0

export const init = <T>(): Rrb<T> => ({
  count: 0,
  height: 0,
  root: { height: 0, items: [] },
})

export const append = <T>(xs: Rrb<T>, x: T): Rrb<T> => {
  // grow the tree to ensure there is enough space
  const grown = grow(xs.root, 1)
  const appended = _append(grown, x)
  // we are guaranteed to have appended because we grew the tree
  if (!appended) throw Error("unreachable")
  // shrink it to remove any redundant levels
  const shrunk = shrink(appended)
  return {
    count: xs.count + 1,
    height: shrunk.height,
    root: shrunk,
  }
}

/**
 * Append `x` to `xs`. Returns null if there is no space.
 */
const _append = <T>(xs: Node<T>, x: T): Node<T> | null => {
  if (isLeaf(xs)) {
    return xs.items.length === M ? null : { ...xs, items: [...xs.items, x] }
  }

  const updated = _append(xs.items[xs.items.length - 1], x) as Branch<T> | null
  if (updated) {
    const items = [...xs.items.slice(0, -1), updated]
    return {
      height: xs.height,
      sizes: calcSizes(items),
      items,
    }
  } else if (xs.items.length < M) {
    const items = [...xs.items, treeOfHeight(xs.height - 1, x)]
    return {
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
    ? { height, items: [x] }
    : { height, sizes: [1], items: [treeOfHeight(height - 1, x)] }

export const get = <T>(xs: Rrb<T>, idx: number): T | null => {
  if (idx >= xs.count) return null
  return getItem(xs.root, idx)
}

const getItem = <T>(node: Node<T>, key: number): T => {
  console.log("== getItem", node, key)
  if (isLeaf(node)) {
    return node.items[key]
  } else {
    const idx = findIndex(key, node.height, node.sizes)
    const next = nextKey(key, idx, node.sizes)
    return getItem(node.items[idx], next)
  }
}

const findIndex = (key: number, height: number, sizes: number[]) => {
  let idx = key >> (BIT_WIDTH * height)
  for (idx; idx < sizes.length; idx++) {
    if (key < sizes[idx]) return idx
  }
  throw Error("Could not find index in sizes")
}

const nextKey = (key: number, idx: number, sizes: number[]): number => {
  const prevSize = idx === 0 ? 0 : sizes[idx - 1]
  return key - prevSize
}

// export const set = <T>(xs: Rrb<T>, idx: number, x: T): Rrb<T> | null => {
//   if (idx >= xs.count) return null
//   return {
//     ...xs,
//     root: setItem(xs.root, idx, xs.height, x),
//   }
// }

// const setItem = <T>(
//   node: Node<T>,
//   key: number,
//   height: number,
//   x: T
// ): Node<T> => {
//   const idx = (key >> (5 * height)) & MASK
//   switch (node._tag) {
//     case "branch":
//       let nextItems = node.items.slice()
//       // unlike append, the sub-node definitely exists
//       nextItems[idx] = setItem(nextItems[idx], key, height - 1, x)
//       return { ...node, items: nextItems }
//     case "leaf": {
//       let nextItems = node.items.slice()
//       nextItems[idx] = x
//       return { _tag: "leaf", items: nextItems }
//     }
//   }
// }

// /**
//  * This is identical to setItem, just with slightly different types, maybe they
//  * can be combined.
//  */
// const setLeaf = <T>(
//   key: number,
//   height: number,
//   leaf: Leaf<T>,
//   node: Node<T>
// ): Node<T> => {
//   const idx = (key >> (5 * height)) & MASK
//   if (node._tag === "leaf") return node // unreachable
//   if (height > 0) {
//     let nextItems = node.items.slice()
//     // When we raise the root, we're not preallocating 31 other branches with
//     // empty items, we're creating them as we need them, so check if it's there.
//     const branch = node.items[idx] ?? { _tag: "branch", items: [] }
//     nextItems[idx] = setLeaf(key, height - 1, leaf, branch)
//     return { ...node, items: nextItems }
//   } else {
//     let nextItems = node.items.slice()
//     nextItems[idx] = leaf
//     return { ...node, items: nextItems }
//   }
// }

export const concat = <T>(left: Rrb<T>, right: Rrb<T>): Rrb<T> => {
  // make trees the same height
  // const height = Math.max(left.height, right.height)
  // const grownLeft = grow(left.root, height - left.height)
  // const grownRight = grow(right.root, height - right.height)
  // merge together
  const merged = _concat(left.root, right.root)
  // chop off any excess levels
  const shrunk = shrink(merged)
  return {
    count: sizeOf(shrunk),
    height: shrunk.height,
    root: shrunk,
  }
}

const _concat = <T>(
  left: Node<T>,
  right: Node<T>,
  top: boolean = true
): Branch<T> => {
  if (left.height > right.height) {
    const middle = _concat(last(left.items as Node<T>[]), right, false)
    // TODO: should this be [...init(left.items), ...middle.items]
    return rebalance(left, middle, null)
  }

  if (left.height < right.height) {
    const middle = _concat(left, last(right.items as Node<T>[]), false)
    // TODO: should this be [...middle.items, ...init(right.items)]
    return rebalance(null, middle, right)
  }

  if (isLeaf(left) && isLeaf(right)) {
    const total = left.items.length + right.items.length
    if (top && total <= M) {
      return {
        height: 1,
        sizes: [total],
        items: [{ height: 0, items: [...left.items, ...right.items] }],
      }
    } else {
      // We don't bother balancing since the outer recursive step will
      // rebalance them later.
      return {
        height: 1,
        sizes: [left.items.length, right.items.length],
        items: [left, right],
      }
    }
  }

  if (!isBranch(left) || !isBranch(right)) throw Error("unreachable")

  const middle = _concat(last(left.items), first(right.items), false)
  return rebalance(left, middle, right)

  // const leftInit = left.items.slice(0, -1)
  // const rightTail = right.items.slice(1)
  // const leftLast = left.items[left.items.length - 1]
  // const rightFirst = right.items[0]
  // const mx = _concat(leftLast, rightFirst)
  // // const middle = (mx.items.length === 1 ? mx.items[0] : mx).items as Node<T>[]
  // const middle = mx.items as Node<T>[]
  // const merged = [...leftInit, ...middle, ...rightTail]
  // const balanced = rebalance(merged)
  // return balanced
}

const calcSizes = <T>(items: Node<T>[]): number[] => {
  let prev = 0
  return items.map(item => (prev += sizeOf(item)))
}

// const mergeLeaves = <T>(left: Leaf<T>, right: Leaf<T>): Branch<T> => {
//   const items = [...left.items, ...right.items]
//   let branch: Branch<T> = { height: 1, sizes: [], items: [] }
//   let leaf: Leaf<T> = { height: 0, items: [] }
//   for (let i = 0; i < items.length; i++) {
//     if (leaf.items.length === M) {
//       branch.items.push(leaf)
//       leaf = { height: 0, items: [] }
//     }
//     leaf.items.push(items[i])
//   }
//   if (leaf.items.length > 0) {
//     branch.items.push(leaf)
//   }
//   branch.sizes = calcSizes(branch.items)
//   return branch
// }

const rebalance = <T>(
  left: Node<T> | null,
  middle: Node<T>,
  right: Node<T> | null,
  top: boolean
): Branch<T> => {
  const merged = merge(left, middle, right)
  const plan = createConcatPlan(merged) // TODO
  const balanced = executeConcatPlan(merged, plan) // TODO

  // TODO
  if (n <= M) {
    return top ? T : ⟨T⟩
  } else {
    L′ ←INTERNAL - NODE - COPY(T, 0, M)
    R′ ←INTERNAL - NODE - COPY(T, M, n − M)
    return ⟨L′, R′⟩
  }

  // if (items.length === 0) throw Error("no items")
  // const height = items[0].height
  // if (Number.isNaN(height) || typeof height !== "number") {
  //   console.log("== items[0]", items[0])
  //   throw Error("not number")
  // }
  // let root: Branch<T> = { height: height + 3, sizes: [], items: [] }
  // let node: Branch<T> = { height: height + 2, sizes: [], items: [] }
  // let child: Branch<T> = { height: height + 1, sizes: [], items: [] }
  // for (let i = 0; i < items.length; i++) {
  //   if (child.items.length === M) {
  //     child.sizes = calcSizes(child.items)
  //     node.items.push(child)
  //     child = { height: height + 1, sizes: [], items: [] }
  //   }
  //   if (node.items.length === M) {
  //     node.sizes = calcSizes(node.items)
  //     root.items.push(node)
  //     node = { height: height + 2, sizes: [], items: [] }
  //   }
  //   child.items.push(items[i])
  // }
  // if (child.items.length > 0) {
  //   child.sizes = calcSizes(child.items)
  //   node.items.push(child)
  // }
  // if (node.items.length > 0) {
  //   node.sizes = calcSizes(node.items)
  //   root.items.push(node)
  // }
  // root.sizes = calcSizes(root.items)
  // return root
}

/*
 * Create a new node containing [init(left), middle, tail(right)] items. May
 * contain more than M items.
 */
const merge = <T>(
  left: Node<T> | null,
  middle: Node<T>,
  right: Node<T> | null
): Node<T> => {
  const height = middle.height
  const node: Node<T> =
    middle.height === 0
      ? { height: 0, items: [] }
      : { height, sizes: [], items: [] }

  if (left) {
    node.items.push(...(left.items.slice(0, -1) as any))
    if (isBranch(node))
      node.sizes.push(...(left as Branch<T>).sizes.slice(0, -1))
  }

  node.items.push(...(middle.items as any))
  if (isBranch(node)) node.sizes.push(...(middle as Branch<T>).sizes)

  if (right) {
    node.items.push(...(right.items.slice(1) as any))
    if (isBranch(node)) node.sizes.push(...(right as Branch<T>).sizes.slice(1))
  }

  return node
}

const grow = <T>(node: Node<T>, height: number): Node<T> => {
  if (height <= 0) return node
  return {
    height: node.height + 1,
    sizes: [sizeOf(node)],
    items: [grow(node, height - 1)],
  }
}

const shrink = <T>(node: Node<T>): Node<T> =>
  isLeaf(node) || node.items.length > 1 ? node : shrink(node.items[0])

const sizeOf = <T>(tree: Node<T>): number => {
  if (typeof tree === "number") throw Error("gotcha")
  if (isLeaf(tree)) return tree.items.length
  return tree.sizes[tree.sizes.length - 1]
}

const first = <T>(arr: T[]): T => arr[0]
const last = <T>(arr: T[]): T => arr[arr.length - 1]
