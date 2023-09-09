import { describe, test, expect } from "@jest/globals"
import { init, append, get, concat } from "./index"

test("append", () => {
  const size = Math.pow(32, 3)

  let rrb = init<number>()
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
    const left = append(init<number>(), 0)
    const right = append(init<number>(), 1)

    const merged = concat(left, right)

    expect(merged.count).toBe(2)

    expect(get(merged, 0)).toBe(0)
    expect(get(merged, 1)).toBe(1)
  })

  test("concat(big, big)", () => {
    const size = Math.pow(32, 2) + 10

    let rrb = init<number>()
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

    let big = init<number>()
    for (let i = 0; i < size; i++) {
      big = append(big, i)
    }

    const small = append(init<number>(), 0)

    const merged = concat(big, small)

    expect(merged.count).toBe(size + 1)

    for (let i = 0; i < size + 1; i++) {
      expect(get(merged, i)).toBe(i % size)
    }
  })

  test("concat(small, big)", () => {
    const size = Math.pow(32, 2) + 10

    let big = init<number>()
    for (let i = 0; i < size; i++) {
      big = append(big, i)
    }

    const small = append(init<number>(), 0)

    const merged = concat(small, big)

    expect(merged.count).toBe(size + 1)

    for (let i = 0; i < size + 1; i++) {
      expect(get(merged, i)).toBe(i === 0 ? 0 : i - 1)
    }
  })

  test("concat(small, empty)", () => {
    const empty = init<number>()
    const small = append(empty, 0)

    const merged = concat(small, empty)

    expect(merged.count).toBe(1)
    expect(get(merged, 0)).toBe(0)
  })
})
