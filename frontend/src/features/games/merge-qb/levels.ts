export type Point = { x: number; y: number }

// Coordinates are fractions of the source image, measured from its top-left corner.
export type ColliderShape =
  | { type: 'circle'; x: number; y: number; radius: number }
  | { type: 'rectangle'; x: number; y: number; width: number; height: number }
  | { type: 'polygon'; vertices: Point[] }

export type QbLevel = {
  id: string
  name: string
  image: string
  sourceSize: { width: number; height: number }
  visualSize: { width: number; height: number }
  physicsSize: { width: number; height: number }
  mass: number
  collider: { shapes: ColliderShape[] }
  nextId: string | null
  points: number
}

// Geometry was measured from the alpha >= 64 silhouettes of the 11 local PNGs.
// Collider vertices are simplified convex hulls in source-image coordinates.
// mass is in Matter.js mass units (> 0): larger values resist motion more; setMass keeps it independent of size.
export const QB_LEVELS: readonly QbLevel[] = [
  {
    id: '01',
    name: '一级 QB',
    image: '01.png',
    sourceSize: { width: 35, height: 47 },
    visualSize: { width: 23.82, height: 31.99 },
    physicsSize: { width: 23.82, height: 31.99 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.114, y: 0.234 },
            { x: 0.2, y: 0.149 },
            { x: 0.429, y: 0.064 },
            { x: 0.686, y: 0.106 },
            { x: 0.8, y: 0.191 },
            { x: 0.914, y: 0.383 },
            { x: 0.943, y: 0.702 },
            { x: 0.857, y: 0.83 },
            { x: 0.6, y: 0.979 },
            { x: 0.371, y: 0.979 },
            { x: 0.114, y: 0.83 },
            { x: 0.029, y: 0.702 },
          ],
        },
      ],
    },
    mass: 1.8,
    nextId: '02',
    points: 1,
  },
  {
    id: '02',
    name: '二级 QB',
    image: '02.png',
    sourceSize: { width: 97, height: 119 },
    visualSize: { width: 37, height: 45.39 },
    physicsSize: { width: 37, height: 45.39 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.052, y: 0.294 },
            { x: 0.124, y: 0.151 },
            { x: 0.258, y: 0.059 },
            { x: 0.423, y: 0.008 },
            { x: 0.567, y: 0.008 },
            { x: 0.711, y: 0.059 },
            { x: 0.845, y: 0.168 },
            { x: 0.907, y: 0.269 },
            { x: 0.969, y: 0.563 },
            { x: 0.804, y: 0.992 },
            { x: 0.196, y: 0.992 },
            { x: 0.01, y: 0.613 },
          ],
        },
      ],
    },
    mass: 2.2,
    nextId: '03',
    points: 3,
  },
  {
    id: '03',
    name: '三级 QB',
    image: '03.png',
    sourceSize: { width: 662, height: 969 },
    visualSize: { width: 33.46, height: 48.97 },
    physicsSize: { width: 33.46, height: 48.97 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.006, y: 0.822 },
            { x: 0.109, y: 0.264 },
            { x: 0.15, y: 0.186 },
            { x: 0.29, y: 0.07 },
            { x: 0.556, y: 0.003 },
            { x: 0.708, y: 0.021 },
            { x: 0.958, y: 0.171 },
            { x: 0.992, y: 0.333 },
            { x: 0.876, y: 0.863 },
            { x: 0.648, y: 0.975 },
            { x: 0.424, y: 0.999 },
            { x: 0.106, y: 0.911 },
          ],
        },
      ],
    },
    mass: 2.69,
    nextId: '04',
    points: 6,
  },
  {
    id: '04',
    name: '四级 QB',
    image: '04.png',
    sourceSize: { width: 280, height: 326 },
    visualSize: { width: 50.68, height: 59.01 },
    physicsSize: { width: 50.68, height: 59.01 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.011, y: 0.77 },
            { x: 0.314, y: 0.169 },
            { x: 0.371, y: 0.089 },
            { x: 0.532, y: 0.015 },
            { x: 0.70714, y: 0.003 },
            { x: 0.85, y: 0.049 },
            { x: 0.971, y: 0.175 },
            { x: 0.993, y: 0.291 },
            { x: 0.825, y: 0.957 },
            { x: 0.771, y: 0.997 },
            { x: 0.054, y: 0.997 },
            { x: 0.0, y: 0.957 },
          ],
        },
      ],
    },
    mass: 3.3,
    nextId: '05',
    points: 10,
  },
  {
    id: '05',
    name: '五级 QB',
    image: '05.png',
    sourceSize: { width: 295, height: 451 },
    visualSize: { width: 46.44, height: 71.0 },
    physicsSize: { width: 46.44, height: 71.0 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.0, y: 0.093 },
            { x: 0.054, y: 0.018 },
            { x: 0.112, y: 0.0 },
            { x: 0.861, y: 0.0 },
            { x: 0.959, y: 0.058 },
            { x: 0.997, y: 0.129 },
            { x: 0.993, y: 0.772 },
            { x: 0.908, y: 0.925 },
            { x: 0.841, y: 0.998 },
            { x: 0.108, y: 0.998 },
            { x: 0.027, y: 0.92 },
            { x: 0.0, y: 0.849 },
          ],
        },
      ],
    },
    mass: 4.1,
    nextId: '06',
    points: 15,
  },
  {
    id: '06',
    name: '六级 QB',
    image: '06.png',
    sourceSize: { width: 221, height: 332 },
    visualSize: { width: 56.59, height: 85.02 },
    physicsSize: { width: 56.59, height: 85.02 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.0, y: 0.729 },
            { x: 0.054, y: 0.175 },
            { x: 0.235, y: 0.042 },
            { x: 0.403, y: 0.003 },
            { x: 0.557, y: 0.012 },
            { x: 0.683, y: 0.066 },
            { x: 0.923, y: 0.337 },
            { x: 0.991, y: 0.723 },
            { x: 0.878, y: 0.87 },
            { x: 0.615, y: 0.988 },
            { x: 0.285, y: 0.964 },
            { x: 0.068, y: 0.831 },
          ],
        },
      ],
    },
    mass: 5.13,
    nextId: '07',
    points: 21,
  },
  {
    id: '07',
    name: '七级 QB',
    image: '07.png',
    sourceSize: { width: 1132, height: 1671 },
    visualSize: { width: 68.4, height: 100.97 },
    physicsSize: { width: 68.4, height: 100.97 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.007, y: 0.641 },
            { x: 0.163, y: 0.13 },
            { x: 0.28, y: 0.045 },
            { x: 0.425, y: 0.008 },
            { x: 0.743, y: 0.036 },
            { x: 0.882, y: 0.131 },
            { x: 0.998, y: 0.442 },
            { x: 0.798, y: 0.904 },
            { x: 0.585, y: 0.994 },
            { x: 0.439, y: 0.996 },
            { x: 0.242, y: 0.932 },
            { x: 0.064, y: 0.771 },
          ],
        },
      ],
    },
    mass: 6.41,
    nextId: '08',
    points: 28,
  },
  {
    id: '08',
    name: '八级 QB',
    image: '08.png',
    sourceSize: { width: 696, height: 932 },
    visualSize: { width: 90.41, height: 121.07 },
    physicsSize: { width: 90.41, height: 121.07 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.007, y: 0.667 },
            { x: 0.26, y: 0.126 },
            { x: 0.384, y: 0.044 },
            { x: 0.619, y: 0.009 },
            { x: 0.81, y: 0.072 },
            { x: 0.94, y: 0.237 },
            { x: 0.994, y: 0.753 },
            { x: 0.841, y: 0.909 },
            { x: 0.71, y: 0.97 },
            { x: 0.493, y: 0.999 },
            { x: 0.244, y: 0.93 },
            { x: 0.106, y: 0.83 },
          ],
        },
      ],
    },
    mass: 8.15,
    nextId: '09',
    points: 36,
  },
  {
    id: '09',
    name: '九级 QB',
    image: '09.png',
    sourceSize: { width: 916, height: 841 },
    visualSize: { width: 142.99, height: 131.29 },
    physicsSize: { width: 142.99, height: 131.29 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.011, y: 0.306 },
            { x: 0.081, y: 0.114 },
            { x: 0.13, y: 0.061 },
            { x: 0.261, y: 0.002 },
            { x: 0.462, y: 0.045 },
            { x: 0.529, y: 0.073 },
            { x: 0.529, y: 0.91 },
            { x: 0.368, y: 0.807 },
            { x: 0.05, y: 0.505 },
            { x: 0.002, y: 0.415 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.48, y: 0.055 },
            { x: 0.567, y: 0.058 },
            { x: 0.63, y: 0.105 },
            { x: 0.783, y: 0.293 },
            { x: 0.838, y: 0.421 },
            { x: 0.991, y: 0.872 },
            { x: 0.963, y: 0.952 },
            { x: 0.849, y: 0.974 },
            { x: 0.702, y: 0.966 },
            { x: 0.48, y: 0.883 },
          ],
        },
      ],
    },
    mass: 10.25,
    nextId: '10',
    points: 45,
  },
  {
    id: '10',
    name: '十级 QB',
    image: '10.png',
    sourceSize: { width: 714, height: 626 },
    visualSize: { width: 170.03, height: 149.07 },
    physicsSize: { width: 170.03, height: 149.07 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.006, y: 0.7 },
            { x: 0.127, y: 0.34 },
            { x: 0.382, y: 0.024 },
            { x: 0.462, y: 0.002 },
            { x: 0.525, y: 0.048 },
            { x: 0.99, y: 0.724 },
            { x: 0.961, y: 0.871 },
            { x: 0.849, y: 0.992 },
            { x: 0.801, y: 0.997 },
            { x: 0.147, y: 0.984 },
            { x: 0.07, y: 0.923 },
            { x: 0.008, y: 0.794 },
          ],
        },
      ],
    },
    mass: 13.04,
    nextId: '11',
    points: 55,
  },
  {
    id: '11',
    name: '大 QB',
    image: '11.png',
    sourceSize: { width: 1827, height: 679 },
    visualSize: { width: 202.03, height: 75.08 },
    physicsSize: { width: 202.03, height: 75.08 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.172, y: 0.349 },
            { x: 0.25, y: 0.056 },
            { x: 0.274, y: 0.029 },
            { x: 0.331, y: 0.046 },
            { x: 0.5, y: 0.221 },
            { x: 0.5, y: 0.349 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.45, y: 0.208 },
            { x: 0.455, y: 0.208 },
            { x: 0.788, y: 0.247 },
            { x: 0.8, y: 0.249 },
            { x: 0.8, y: 0.349 },
            { x: 0.45, y: 0.349 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.75, y: 0.249 },
            { x: 0.895, y: 0.006 },
            { x: 0.906, y: 0.003 },
            { x: 0.924, y: 0.087 },
            { x: 0.926, y: 0.349 },
            { x: 0.75, y: 0.349 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.001, y: 0.574 },
            { x: 0.062, y: 0.421 },
            { x: 0.196, y: 0.3 },
            { x: 0.55, y: 0.3 },
            { x: 0.55, y: 0.719 },
            { x: 0.021, y: 0.719 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.5, y: 0.3 },
            { x: 0.927, y: 0.3 },
            { x: 0.926, y: 0.346 },
            { x: 0.919, y: 0.398 },
            { x: 0.824, y: 0.719 },
            { x: 0.5, y: 0.719 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.011, y: 0.68 },
            { x: 0.7, y: 0.68 },
            { x: 0.7, y: 0.884 },
            { x: 0.276, y: 0.993 },
            { x: 0.187, y: 0.951 },
            { x: 0.03, y: 0.739 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.65, y: 0.68 },
            { x: 0.779, y: 0.68 },
            { x: 0.974, y: 0.769 },
            { x: 0.997, y: 0.997 },
            { x: 0.811, y: 0.957 },
            { x: 0.65, y: 0.872 },
          ],
        },
      ],
    },
    mass: 16.66,
    nextId: null,
    points: 66,
  },
]

export const QB_LEVEL_BY_ID = new Map(QB_LEVELS.map((level) => [level.id, level]))

export function levelOutlineBounds(level: QbLevel) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  const include = (x: number, y: number) => {
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  for (const shape of level.collider.shapes) {
    if (shape.type === 'polygon') {
      for (const vertex of shape.vertices) include(vertex.x, vertex.y)
    } else if (shape.type === 'rectangle') {
      include(shape.x - shape.width / 2, shape.y - shape.height / 2)
      include(shape.x + shape.width / 2, shape.y + shape.height / 2)
    } else {
      const radius = shape.radius * Math.min(level.physicsSize.width, level.physicsSize.height)
      include(
        shape.x - radius / level.physicsSize.width,
        shape.y - radius / level.physicsSize.height,
      )
      include(
        shape.x + radius / level.physicsSize.width,
        shape.y + radius / level.physicsSize.height,
      )
    }
  }
  return { left, top, right, bottom }
}

export function levelImagePath(level: QbLevel) {
  return `images/games/merge-qb/${level.image}`
}

// Matter.js combines dynamic friction with min(A, B), static multiplier with max(A, B).
// friction is dynamic contact drag [0, 1]; frictionStatic is a multiplier >= 0, not a separate coefficient.
// Increasing either resists sliding. frictionAir is per-step drag in air [0, 1].
// restitution is bounce [0, 1]: larger values rebound more.
export const QB_PHYSICS = {
  qb: { friction: 0.58, frictionStatic: 0.8, frictionAir: 0.002, restitution: 0.08 },
  wall: { friction: 0.58, frictionStatic: 0.8, restitution: 0.08 },
} as const

// Pixel stroke is rendered at final canvas scale, independent of level size and DPR.
export const QB_OUTLINE = { widthCssPx: 1.5, color: '#332b27' } as const

// Force is applied once per merge in Matter.js world units; caps keep large merges contained.
export const QB_SHOCKWAVE = {
  baseRadius: 115,
  radiusPerSize: 0.9,
  maxRadius: 300,
  baseForce: 0.0045,
  forcePerSize: 0.000045,
  maxForce: 0.02,
  durationMs: 420,
  lineWidthCssPx: 2,
} as const
