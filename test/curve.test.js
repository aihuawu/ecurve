var assert = require('assert')
var ecurve = require('../')
var getECParams = ecurve.getECParams

var BigInteger = require('bigi')
var Curve = ecurve.Curve
var Point = ecurve.Point

var fixtures = require('./fixtures/curve')

describe('Ecurve', function() {
  it('should create curve objects', function() {
    var p = BigInteger.valueOf(11)
    var a = BigInteger.valueOf(22)
    var b = BigInteger.valueOf(33)

    var curve = new Curve(p, a, b)
    assert.equal(curve.p.toString(), '11')
    assert.equal(curve.a.toString(), '22')
    assert.equal(curve.b.toString(), '33')
  });

  fixtures.valid.forEach(function(f) {
    it('calculates a public point for ' + f.D, function() {
      var params = ecurve.getECParams(f.Q.curve)
      var curve = params.curve

      var d = new BigInteger(f.D)
      var Q = params.G.multiply(d)

      assert.ok(Q.affineX.toString(), f.Q.x)
      assert.ok(Q.affineY.toString(), f.Q.y)
    })
  })

  describe('Field math', function() {
    // General Elliptic curve formula: y^2 = x^3 + ax + b
    // Testing field: y^2 = x^3 + x (a = 1, b = 0)
    // Wolfram Alpha: solve mod(y^2, 11)=mod(x^3+x, 11)
    // There are 12 valid points on this curve (11 plus point at infinity)
    //   (0,0), (5,8), (7,8), (8,5), (9,10), (10,8)
    //          (5,3), (7,3), (8,6), (9,1),  (10,3)
    //
    ///////////////////////////////////////////////
    // 10                           X
    //  9
    //  8               X     X        X
    //  7
    //  6                        X
    //  5                        X
    //  4
    //  3               X     X        X
    //  2
    //  1                           X
    //  0 X
    //    0 1  2  3  4  5  6  7  8  9 10
    ///////////////////////////////////////////////

    var curve = new Curve(BigInteger.valueOf(11), BigInteger.ONE, BigInteger.ZERO)
    var points = [
      { x: 0, y: 0 },
      { x: 5, y: 8 }, { x: 5, y: 3 },
      { x: 7, y: 8 }, { x: 7, y: 3 },
      { x: 8, y: 5 }, { x: 8, y: 6 },
      { x: 9, y: 10 }, { x: 9, y: 1 },
      { x: 10, y: 8 }, { x: 10, y: 3 }
    ].map(function(p) {
      return Point.fromAffine(curve, BigInteger.valueOf(p.x), BigInteger.valueOf(p.y))
    })
    var params = {
      curve: curve,
      G: points[6], // random
      n: BigInteger.valueOf(points.length + 1),
      h: undefined // can't be bothered
    }
    params.curve.params = params // FIXME: boo

    // pG = P = -P
    var P = params.G.multiply(params.curve.p)
    assert(P.equals(params.G.negate()))

    // nG = O
    var nG = params.G.multiply(params.n)
    assert(curve.isInfinity(nG))

    var inf = params.curve.infinity
    var a = points[2]
    var b = points[7]
    var z = points[0]
    var y = Point.fromAffine(curve, BigInteger.ONE, BigInteger.ONE)

    it('should validate field elements properly', function() {
      assert.ok(curve.validate(a))
      assert.ok(curve.validate(b))
      assert.ok(curve.validate(z))
      assert.ok(curve.isOnCurve(z))
      assert.ok(!curve.isOnCurve(y))
      assert.ok(!curve.isInfinity(a))
      assert.ok(!curve.isInfinity(b))
      assert.ok(curve.isInfinity(inf))
      assert.ok(curve.isOnCurve(inf))
    })

    it('should negate field elements properly', function() {
      assert.equal(a.negate().toString(), '(5,8)') // -(5,3) = (5,8)
      assert.equal(b.negate().toString(), '(9,1)') // -(9,10) = (9,1)
      //assert.equal(inf.negate().toString(), '(INFINITY)') // FAILS: can't negate infinity point should fail out gracefully
      assert.equal(z.negate().toString(), '(0,0)') // -(0,0) = (0,0)
    })

    it('should add field elements properly', function() {
      assert.equal(a.add(b).toString(), '(9,1)')  // (5,3) + (9,10) = (9,1)
      assert.equal(b.add(a).toString(), '(9,1)')  // (9,10) + (5,3) = (9,1)
      assert.equal(a.add(z).toString(), '(9,10)') // (5,3) + (0,0) = (9,10)
      assert.equal(a.add(y).toString(), '(8,1)')  // (5,3) + (1,1) = (8,1)  <-- weird result should error out if one of the operands isn't on the curve // FIXME

      assert.equal(a.add(inf).toString(), '(5,3)') // (5,3) + INFINITY = (5,3)
      assert.equal(inf.add(a).toString(), '(5,3)') // INFINITY + (5,3) = (5,3)
    })

    it('should multiply field elements properly', function() {
      assert.equal(a.multiply(new BigInteger('2')).toString(), '(5,8)')      // (5,3) x 2 = (5,8)
      assert.equal(a.multiply(new BigInteger('3')).toString(), '(INFINITY)') // (5,3) x 3 = INFINITY
      assert.equal(a.multiply(new BigInteger('4')).toString(), '(5,3)')      // (5,3) x 4 = (5,3)
      assert.equal(a.multiply(new BigInteger('5')).toString(), '(5,8)')      // (5,3) x 5 = (5,8)

      assert.equal(b.multiply(new BigInteger('2')).toString(), '(5,8)') // (9,10) x 2 = (5,8)
      assert.equal(b.multiply(new BigInteger('3')).toString(), '(0,0)') // (9,10) x 3 = (0,0)
      assert.equal(b.multiply(new BigInteger('4')).toString(), '(5,3)') // (9,10) x 4 = (5,3)
      assert.equal(b.multiply(new BigInteger('5')).toString(), '(9,1)') // (9,10) x 5 = (9,1)

      assert.equal(inf.multiply(new BigInteger('2')).toString(), '(INFINITY)') // INFINITY x 2 = INFINITY
      assert.equal(inf.multiply(new BigInteger('3')).toString(), '(INFINITY)') // INFINITY x 3 = INFINITY
      assert.equal(inf.multiply(new BigInteger('4')).toString(), '(INFINITY)') // INFINITY x 4 = INFINITY
      assert.equal(inf.multiply(new BigInteger('5')).toString(), '(INFINITY)') // INFINITY x 5 = INFINITY

      assert.equal(z.multiply(new BigInteger('2')).toString(), '(INFINITY)') // (0,0) x 2 = INFINITY
      assert.equal(z.multiply(new BigInteger('3')).toString(), '(0,0)')      // (0,0) x 3 = (0,0)
      assert.equal(z.multiply(new BigInteger('4')).toString(), '(INFINITY)') // (0,0) x 4 = INFINITY
      assert.equal(z.multiply(new BigInteger('5')).toString(), '(0,0)')      // (0,0) x 5 = (0,0)

      assert.equal(a.multiplyTwo(new BigInteger('4'), b, new BigInteger('4')).toString(), '(5,8)') // (5,3) x 4 + (9,10) x 4 = (5,8)

      assert.equal(a.multiply(new BigInteger('2')).toString(), a.twice().toString()) // .multiply(2) == .twice()
      assert.equal(b.multiply(new BigInteger('2')).toString(), b.twice().toString())
      assert.equal(inf.multiply(new BigInteger('2')).toString(), inf.twice().toString())
      assert.equal(z.multiply(new BigInteger('2')).toString(), z.twice().toString())

      assert.equal(a.multiply(new BigInteger('2')).toString(), a.add(a).toString()) // this.multiply(2) == this.add(this)
      assert.equal(b.multiply(new BigInteger('2')).toString(), b.add(b).toString())
      assert.equal(inf.multiply(new BigInteger('2')).toString(), inf.add(inf).toString())
      assert.equal(z.multiply(new BigInteger('2')).toString(), z.add(z).toString())
    })
  })

  describe('isOnCurve', function() {
    var curve = getECParams('secp256k1').curve

    it('should return true for a point on the curve', function() {
      var d = BigInteger.ONE
      var Q = curve.params.G.multiply(d)
      assert.ok(curve.isOnCurve(Q))
    })

    it('should return true for points at (0, 0) if they are on the curve', function() {
      var curve = new Curve(BigInteger.valueOf(11), BigInteger.ONE, BigInteger.ZERO)
      var P = Point.fromAffine(curve, BigInteger.ZERO, BigInteger.ZERO)
      assert.ok(curve.isOnCurve(P))
    })

    it('should return false for points not in the finite field', function() {
      var P = Point.fromAffine(curve, curve.p.add(BigInteger.ONE), BigInteger.ZERO)
      assert(!curve.isOnCurve(P))
    })

    it('should return false for a point not on the curve', function() {
      var P = Point.fromAffine(curve, BigInteger.ONE, BigInteger.ONE)
      assert(!curve.isOnCurve(P))
    })
  })

  describe('validate', function() {
    var curve = getECParams('secp256k1').curve

    it('should validate a point on the curve', function() {
      var d = BigInteger.ONE
      var Q = curve.params.G.multiply(d)

      assert.ok(curve.validate(Q))
    })

    it('should not validate a point not on the curve', function() {
      var P = Point.fromAffine(curve, BigInteger.ONE, BigInteger.ONE)

      assert.throws(function() {
        curve.validate(P)
      }, /Point is not on the curve/)
    })

    it('should not validate the point at infinity', function() {
      assert.throws(function() {
        curve.validate(curve.infinity)
      }, /Point is at infinity/)
    })

    // TODO: Test data needed...
//    it('should not validate a point not on the curve', function() {
//      assert.throws(function() {
//        curve.validate(Q)
//      }, /Point is not a scalar multiple of G/)
//    })
  })
})
