import { describe, test, expect } from "@jest/globals"
import {
  init,
  get,
  concat,
  Branch,
  Rrb,
  fromArray,
  isLeaf,
  Node,
  M,
  E_MAX,
} from "./index"
import fc from "fast-check"

describe("concat", () => {
  test("branches with a height > 1 are rebalanced", () => {
    const sizes = [1025, 1025, 1025, 1025]
    const arrs = sizes.map(arrayOfSize)
    const vecs = arrs.map(fromArray)
    const merged = concatMany(vecs)

    assertEqualElements(merged, arrs.flat())
    assertSearchStepInvariant(merged.root)
  })

  test("distributing slots with a remainder", () => {
    const vec = fromArray(arrayOfSize(17))
    const left = concatMany([vec, vec, vec, vec, vec, vec])
    expect(left.root.type).toBe("branch")
    const leftItems = (left.root as Branch<string>).items.map(
      item => item.items.length
    )
    expect(leftItems).toEqual([17, 17, 17, 17, 17, 17])

    const merged = concat(left, vec)
    expect(merged.root.type).toBe("branch")
    const mergedItems = (merged.root as Branch<string>).items.map(
      item => item.items.length
    )
    expect(mergedItems).toEqual([32, 19, 17, 17, 17, 17])
  })

  test("order of elements is maintained", () => {
    const arb = fc.array(fc.nat({ max: 1024 }), {
      maxLength: 10,
    })

    fc.assert(
      fc.property(arb, sizes => {
        const arrs = sizes.map(arrayOfSize)
        const vecs = arrs.map(fromArray)
        const merged = concatMany(vecs)

        assertEqualElements(merged, arrs.flat())
      }),
      { numRuns: 100 }
    )
  })

  test("search step invariant is maintained", () => {
    const arb = fc.array(fc.nat({ max: 32_768 }), {
      maxLength: 10,
    })

    fc.assert(
      fc.property(arb, sizes => {
        const arrs = sizes.map(arrayOfSize)
        const vecs = arrs.map(fromArray)
        const merged = concatMany(vecs)

        assertSearchStepInvariant(merged.root)
      }),
      { numRuns: 1000 }
    )
  })

  test("height invariant is maintained", () => {
    const arb = fc.array(fc.nat({ max: 32_768 }), {
      maxLength: 10,
    })

    fc.assert(
      fc.property(arb, sizes => {
        const arrs = sizes.map(arrayOfSize)
        const vecs = arrs.map(fromArray)
        const merged = concatMany(vecs)

        const length = arrs.flat().length
        const heightLeastDense =
          length > 0 ? Math.log(length) / Math.log(M - E_MAX) : 0
        const heightMostDense =
          length > 0 ? Math.ceil(Math.log(length) / Math.log(M)) - 1 : 0

        expect(merged.root.height).toBeLessThanOrEqual(heightLeastDense)
        expect(merged.root.height).toBeGreaterThanOrEqual(heightMostDense)
      }),
      { numRuns: 1000 }
    )
  })
})

const base26 = (i: number): string => {
  if (i < 26) return String.fromCharCode(i + 65)
  return `${base26(Math.floor(i / 26) - 1)}${base26(i % 26)}`
}

const arrayOfSize = (size: number): Array<string> =>
  new Array(size).fill(null).map((_, i) => base26(i))

const concatMany = <T>(vecs: Array<Rrb<T>>): Rrb<T> => {
  if (vecs.length === 0) return init()
  const [head, ...tail] = vecs
  let output = head
  for (const next of tail) {
    output = concat(output, next)
  }
  return output
}

const assertEqualElements = <T>(vec: Rrb<T>, arr: Array<T>): void => {
  expect(vec.count).toBe(arr.length)
  arr.forEach((item, i) => {
    expect(get(vec, i)).toBe(item)
  })
}

const assertSearchStepInvariant = <T>(vec: Node<T>): void => {
  if (isLeaf(vec)) {
    return
  } else {
    const s = vec.items.reduce((acc, item) => acc + item.items.length, 0)
    const opt = Math.ceil(s / M)
    const limit = opt + E_MAX
    expect(vec.items.length).toBeLessThanOrEqual(limit)

    if (vec.height > 1) {
      vec.items.forEach(assertSearchStepInvariant)
    }
  }
}
