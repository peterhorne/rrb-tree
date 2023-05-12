import { describe, test, expect } from '@jest/globals'
import { init, append, get, concat } from './index'

test("append", () => {
  const size = Math.pow(32, 3)

  let rrb = init<number>()
  for (let i = 0; i < size; i++) {
    rrb = append(rrb, i)
  }

  expect(rrb.count).toBe(size)
  expect(rrb.height).toBe(2)

  for (let i = 0; i < size; i++) {
    expect(get(rrb, i)).toBe(i)
  }
})

describe("concat", () => {
  test.only("concat(big, big)", () => {
    const size = Math.pow(32, 2) + 10

    let rrb = init<number>()
    for (let i = 0; i < size; i++) {
      rrb = append(rrb, i)
    }

    const merged = concat(rrb, rrb)

    expect(merged.count).toBe(size * 2)
    expect(merged.height).toBe(2) // TODO

    // for (let i = 0; i < size * 2; i++) {
    //   expect(get(merged, i)).toBe(i % size)
    // }

    expect(get(merged, 2048)).toBe(1024)
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
    expect(merged.height).toBe(2) // TODO

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
    expect(merged.height).toBe(3) // TODO

    for (let i = 0; i < size + 1; i++) {
      expect(get(merged, i)).toBe(i === 0 ? 0 : i - 1)
    }
  })
})
