import { describe, test, expect } from "@jest/globals"
import { initRrb, append, get, concat, Branch, Rrb } from "./index"

const base26 = (i: number): string => {
  if (i < 26) return String.fromCharCode(i + 65)
  return `${base26(Math.floor(i / 26) - 1)}${base26(i % 26)}`
}

const vecOfSize = (size: number): Rrb<string> => {
  let vec = initRrb<string>()
  for (var i = 0; i < size; i++) {
    vec = append(vec, base26(i))
  }
  return vec
}

const concatMany = <T>(vecs: Array<Rrb<T>>): Rrb<T> => {
  const [head, ...tail] = vecs
  let output = head
  for (const next of tail) {
    output = concat(output, next)
  }
  return output
}

test("append", () => {
  const size = Math.pow(32, 3)

  let rrb = initRrb<number>()
  for (let i = 0; i < size; i++) {
    rrb = append(rrb, i)
  }

  expect(rrb.count).toBe(size)

  for (let i = 0; i < size; i++) {
    expect(get(rrb, i)).toBe(i)
  }
})

describe("concat", () => {
  test("concat(small, small)", () => {
    const left = append(initRrb<number>(), 0)
    const right = append(initRrb<number>(), 1)

    const merged = concat(left, right)

    expect(merged.count).toBe(2)

    expect(get(merged, 0)).toBe(0)
    expect(get(merged, 1)).toBe(1)
  })

  test("concat(big, big)", () => {
    const size = Math.pow(32, 2) + 10

    let rrb = initRrb<number>()
    for (let i = 0; i < size; i++) {
      rrb = append(rrb, i)
    }

    const merged = concat(rrb, rrb)

    expect(merged.count).toBe(size * 2)

    for (let i = 0; i < size * 2; i++) {
      expect(get(merged, i)).toBe(i % size)
    }
  })

  test("concat(big, small)", () => {
    const size = Math.pow(32, 2) + 10

    let big = initRrb<number>()
    for (let i = 0; i < size; i++) {
      big = append(big, i)
    }

    const small = append(initRrb<number>(), 0)

    const merged = concat(big, small)

    expect(merged.count).toBe(size + 1)

    for (let i = 0; i < size + 1; i++) {
      expect(get(merged, i)).toBe(i % size)
    }
  })

  test("concat(small, big)", () => {
    const size = Math.pow(32, 2) + 10

    let big = initRrb<number>()
    for (let i = 0; i < size; i++) {
      big = append(big, i)
    }

    const small = append(initRrb<number>(), 0)

    const merged = concat(small, big)

    expect(merged.count).toBe(size + 1)

    for (let i = 0; i < size + 1; i++) {
      expect(get(merged, i)).toBe(i === 0 ? 0 : i - 1)
    }
  })

  test("concat(small, empty)", () => {
    const empty = initRrb<number>()
    const small = append(empty, 0)

    const merged = concat(small, empty)

    expect(merged.count).toBe(1)
    expect(get(merged, 0)).toBe(0)
  })
})

test("rebalancing", () => {
  const one = append(initRrb<string>(), "one")
  const two = append(one, "two")
  const three = append(two, "three")
  const four = append(three, "four")

  const five = concat(four, append(initRrb<string>(), "five"))
  const six = concat(five, append(initRrb<string>(), "six"))
  const seven = concat(six, append(initRrb<string>(), "seven"))
  const eight = concat(seven, append(initRrb<string>(), "eight"))

  expect(eight.count).toBe(8)
  expect(eight.root.type).toBe("branch")
  expect((eight.root as Branch<string>).sizes).toEqual([6, 7, 8])
})

test("distributing slots with a remainder", () => {
  const left = concatMany([vecOfSize(2), vecOfSize(31)])
  expect(left.root.type).toBe("branch")
  expect((left.root as Branch<string>).sizes).toEqual([2, 33])

  const right = concatMany([vecOfSize(1), vecOfSize(1), vecOfSize(1)])
  expect(right.root.type).toBe("branch")
  expect((right.root as Branch<string>).sizes).toEqual([1, 2, 3])

  const merged = concat(left, right)
  expect(merged.root.type).toBe("branch")
  expect((merged.root as Branch<string>).sizes).toEqual([32, 34, 35, 36])
})
