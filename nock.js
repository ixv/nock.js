'use strict';

/**
 * Nock is a combinator interpreter on nouns. A noun is an atom or a cell.
 * An atom is an unsigned integer of any size; a cell is an ordered pair of nouns.
 *
 * @see http://urbit.org/docs/theory/whitepaper#-nock
 */

/*** operators ***/

/**
 * wut (?): test for atom (1) or cell (0)
 *
 *   ?[a b]           0
 *   ?a               1
 */
function wut(n) {
  return typeof n === 'number' ? 1 : 0
}

/**
 * lus (+): increment an atom
 *
 *   +[a b]           +[a b]
 *   +a               1 + a
 */
function lus(n) {
  if (wut(n) === 0) throw new Error('lus cell')
  return 1 + n
}

/**
 * tis (=): test equality
 *
 *   =[a a]           0
 *   =[a b]           1
 *   =a               =a
 */
function tis(n) {
  if (wut(n) === 1) throw new Error('tis atom')
  // TODO: s/b recursive?
  return n[0] === n[1] ? 0 : 1
}

/**
 * fas (/): resolve a tree address
 *
 *   /[1 a]           a
 *   /[2 a b]         a
 *   /[3 a b]         b
 *   /[(a + a) b]     /[2 /[a b]]
 *   /[(a + a + 1) b] /[3 /[a b]]
 *   /a               /a
 */
function fas(addr, n) {
  if (n === undefined) throw new Error('invalid fas noun')
  if (addr === 0) throw new Error('invalid fas addr: 0')

  if (addr === 1) return n
  if (addr === 2) return n[0]
  if (addr === 3) return n[1]

  return fas(2 + (addr % 2), fas((addr / 2)|0, n))
}

/*** formulas ***/

/**
 * slot (0): resolve a tree address
 *
 *   *[a 0 b]         /[b a]
 */
function slot(s, f) {
  var p, err

  try { p = fas(f, s) }
  catch (ex) { err = ex }

  if (err) throw err
  if (p === undefined) throw new Error ('invalid fas addr: ' + f)

  return p
}

/**
 * constant (1): return the formula regardless of subject
 *
 *   *[a 1 b]  b
 */
function constant(s, f) {
  return f
}

/**
 * evaluate (2): apply the product of second formula to the product of the first
 *
 *   *[a 2 b c]  *[*[a b] *[a c]]
 */
function evaluate(s, f) {
  return nock(nock(s, f[0]), nock(s, f[1]))
}

/**
 * cell (3): test if the product is a cell
 *
 *   *[a 3 b]         ?*[a b]
 */
function cell(s, f) {
  return wut(nock(s, f))
}

/**
 *  incr (4): increment the product
 *
 *   *[a 4 b]         +*[a b]
 */
function incr(s, f) {
  return lus(nock(s, f))
}

/**
 * eq (5): test for equality between nouns in the product
 *
 *   *[a 5 b]         =*[a b]
 */
function eq(s, f) {
  return tis(nock(s, f))
}

/**
 * ife (6): if/then/else
 *
 *   *[a 6 b c d]      *[a 2 [0 1] 2 [1 c d] [1 0] 2 [1 2 3] [1 0] 4 4 b]
 */
function ife(s, f) {
  // TODO: write expanded macro
  // TODO: fix; this is the simplified version
  return nock(s, f[0]) === 0 ? nock(s, f[1][0]) : nock(s, f[1][1])
}

/**
 * compose (7): evaluate formulas composed left-to-right
 *
 *   *[a 7 b c]  *[a 2 b 1 c]
 */
function compose(s, f) {
  // TODO: write expanded macro:
  // nock(evaluate(s, assoc([f[0], 1, f[1]])))
  // return nock(nock(s, f[0]), constant(s, f[1]))
  return nock(nock(s, f[0]), f[1])
}

/**
 * extend (8): evaluate the product of the first formula against the second
 *
 *   *[a 8 b c]  *[a 7 [[7 [0 1] b] 0 1] c]
 */
function extend(s, f) {
  // TODO: write expanded macro:
  // return nock([compose(s, [[0, 1], f[0]]), s], f[1])
  return nock([nock(s, f[0]), s], f[1])
}

/**
 * invoke (9): evaluate formulas composed right-to-left
 *
 *   *[a 9 b c]  *[a 7 c 2 [0 1] 0 b]
 */
function invoke(s, f) {
  // TODO: write expanded macro:
  // nock(
  //   compose(s, [f[1], [2, s]])
  // )
  var prod = nock(s, f[1])
  return nock(prod, slot(prod, f[0]))
}

/**
 * hint (10): skip first formula, evaluate second
 *
 *   *[a 10 [b c] d]  *[a 8 c 7 [0 3] d]
 *   *[a 10 b c]      *[a c]
 */
function hint(s, f) {
  if (wut(f[0]) === 1) nock(s, f[0][1])
  return nock(s, f[1])
}

/*** indexed formula functions ***/
var formulas = [slot, constant, evaluate, cell, incr, eq, ife, compose, extend, invoke, hint]

/**
 * nock (*)
 *
 * the nock function
 *
 *   *[a [b c] d]     [*[a b c] *[a d]]
 *   *a               *a
 */
function nock(s, f) {
  if (wut(f[0]) === 0) return [nock(s, f[0]), nock(s, f[1])]

  if (f[0] > 10) throw new Error('invalid formula: ' + f[0])

  return formulas[f[0]](s, f[1])
}

/* group an array into pairs, associating right */
function assoc(x) {
  if (!x.length) return x

  if (x.length === 1) return assoc(x[0])

  return [assoc(x[0]), assoc(x.slice(1))]
}

module.exports = {
  nock: function() {
    var args = assoc([].slice.call(arguments))
    return nock(args[0], args[1])
  },
  _nock: nock,
  util: { assoc: assoc },
  operators: {
    wut: wut,
    lus: lus,
    tis: tis,
    fas: fas
  },
  formulas: {
    slot: slot,
    constant: constant,
    evaluate: evaluate,
    cell: cell,
    incr: incr,
    eq: eq,
    ife: ife,
    compose: compose,
    extend: extend,
    invoke: invoke,
    hint: hint
  }
}
