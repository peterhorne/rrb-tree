import { describe, test, expect } from "@jest/globals"
import { initRrb, append, get, concat, Branch } from "./index"

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
