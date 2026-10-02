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

// Geometry was measured from the alpha >= 64 silhouettes of the 12 local PNGs.
// Small convex parts follow exterior concavities; alpha holes inside the art are ignored.
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
            { x: 0.178218, y: 0.755102 },
            { x: 0.287129, y: 0.068027 },
            { x: 0.534653, y: 0 },
            { x: 0.742574, y: 0.027211 },
            { x: 0.950495, y: 0.156463 },
            { x: 1, y: 0.326531 },
            { x: 0.891089, y: 0.598639 },
            { x: 0.782178, y: 0.714286 },
            { x: 0.366337, y: 1 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.287129, y: 0.068027 },
            { x: 0.782178, y: 0.714286 },
            { x: 0.772277, y: 0.823129 },
            { x: 0.653465, y: 0.979592 },
            { x: 0.366337, y: 1 },
            { x: 0.207921, y: 0.653061 },
            { x: 0.19802, y: 0.557823 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.009901, y: 0.809524 },
            { x: 0.178218, y: 0.755102 },
            { x: 0.851485, y: 0.829932 },
            { x: 0.871287, y: 0.877551 },
            { x: 0.653465, y: 0.979592 },
            { x: 0.366337, y: 1 },
            { x: 0.079208, y: 0.904762 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.287129, y: 0.068027 },
            { x: 0.19802, y: 0.557823 },
            { x: 0.09901, y: 0.482993 },
            { x: 0.128713, y: 0.210884 },
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
            { x: 0.254902, y: 0.308989 },
            { x: 0.333333, y: 0.129213 },
            { x: 0.470588, y: 0.033708 },
            { x: 0.647059, y: 0 },
            { x: 0.849673, y: 0.044944 },
            { x: 0.993464, y: 0.219101 },
            { x: 0.993464, y: 0.314607 },
            { x: 0.960784, y: 0.449438 },
            { x: 0.712418, y: 0.775281 },
            { x: 0.254902, y: 0.455056 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0, y: 0.960674 },
            { x: 0.006536, y: 0.775281 },
            { x: 0.137255, y: 0.679775 },
            { x: 0.261438, y: 0.646067 },
            { x: 0.712418, y: 0.775281 },
            { x: 0.823529, y: 0.97191 },
            { x: 0.777778, y: 1 },
            { x: 0.039216, y: 0.994382 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.470588, y: 0.033708 },
            { x: 0.712418, y: 0.775281 },
            { x: 0.777778, y: 1 },
            { x: 0.261438, y: 0.646067 },
            { x: 0.287582, y: 0.47191 },
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
            { x: 0.058824, y: 0.160156 },
            { x: 0.194118, y: 0.058594 },
            { x: 0.388235, y: 0.003906 },
            { x: 0.588235, y: 0.019531 },
            { x: 0.764706, y: 0.132813 },
            { x: 0.876471, y: 0.332031 },
            { x: 0.876471, y: 0.433594 },
            { x: 0.864706, y: 0.566406 },
            { x: 0.8, y: 0.644531 },
            { x: 0.194118, y: 0.59375 },
            { x: 0.070588, y: 0.4375 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0, y: 0.738281 },
            { x: 0.023529, y: 0.652344 },
            { x: 0.876471, y: 0.332031 },
            { x: 0.929412, y: 0.339844 },
            { x: 0.876471, y: 0.433594 },
            { x: 0.229412, y: 0.945313 },
            { x: 0.094118, y: 0.859375 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.8, y: 0.644531 },
            { x: 0.964706, y: 0.683594 },
            { x: 0.994118, y: 0.710938 },
            { x: 0.976471, y: 0.78125 },
            { x: 0.882353, y: 0.875 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.194118, y: 0.058594 },
            { x: 0.8, y: 0.644531 },
            { x: 0.882353, y: 0.875 },
            { x: 0.717647, y: 0.964844 },
            { x: 0.558824, y: 1 },
            { x: 0.4, y: 0.996094 },
            { x: 0.229412, y: 0.945313 },
            { x: 0.194118, y: 0.59375 },
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
            { x: 0.101942, y: 0.610561 },
            { x: 0.286408, y: 0.039604 },
            { x: 0.509709, y: 0 },
            { x: 0.742718, y: 0.033003 },
            { x: 0.883495, y: 0.128713 },
            { x: 0.932039, y: 0.234323 },
            { x: 0.898058, y: 0.531353 },
            { x: 0.796117, y: 0.69637 },
            { x: 0.665049, y: 0.80198 },
            { x: 0.165049, y: 0.884488 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.106796, y: 0.356436 },
            { x: 0.121359, y: 0.217822 },
            { x: 0.160194, y: 0.128713 },
            { x: 0.286408, y: 0.039604 },
            { x: 0.912621, y: 0.39604 },
            { x: 1, y: 0.452145 },
            { x: 0.941748, y: 0.518152 },
            { x: 0.898058, y: 0.531353 },
            { x: 0.135922, y: 0.485149 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.004854, y: 0.643564 },
            { x: 0.033981, y: 0.610561 },
            { x: 0.101942, y: 0.610561 },
            { x: 0.665049, y: 0.80198 },
            { x: 0.800971, y: 0.877888 },
            { x: 0.786408, y: 0.924092 },
            { x: 0.626214, y: 0.990099 },
            { x: 0.165049, y: 0.884488 },
            { x: 0.058252, y: 0.768977 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.286408, y: 0.039604 },
            { x: 0.665049, y: 0.80198 },
            { x: 0.626214, y: 0.990099 },
            { x: 0.451456, y: 1 },
            { x: 0.300971, y: 0.963696 },
            { x: 0.165049, y: 0.884488 },
            { x: 0.121359, y: 0.570957 },
            { x: 0.135922, y: 0.485149 },
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
            { x: 0.176471, y: 0.387363 },
            { x: 0.375, y: 0.046703 },
            { x: 0.540441, y: 0.005495 },
            { x: 0.636029, y: 0.010989 },
            { x: 0.783088, y: 0.054945 },
            { x: 0.871324, y: 0.115385 },
            { x: 0.919118, y: 0.178571 },
            { x: 0.941176, y: 0.230769 },
            { x: 0.941176, y: 0.313187 },
            { x: 0.897059, y: 0.423077 },
            { x: 0.227941, y: 0.554945 },
            { x: 0.1875, y: 0.472527 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.202206, y: 0.260989 },
            { x: 0.253676, y: 0.131868 },
            { x: 0.375, y: 0.046703 },
            { x: 0.897059, y: 0.423077 },
            { x: 0.915441, y: 0.565934 },
            { x: 0.827206, y: 0.67033 },
            { x: 0.213235, y: 0.373626 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.007353, y: 0.664835 },
            { x: 0.113971, y: 0.596154 },
            { x: 0.227941, y: 0.554945 },
            { x: 0.827206, y: 0.67033 },
            { x: 0.981618, y: 0.739011 },
            { x: 0.996324, y: 0.766484 },
            { x: 0.889706, y: 0.879121 },
            { x: 0.198529, y: 0.906593 },
            { x: 0.036765, y: 0.755495 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.375, y: 0.046703 },
            { x: 0.827206, y: 0.67033 },
            { x: 0.889706, y: 0.879121 },
            { x: 0.75, y: 0.958791 },
            { x: 0.602941, y: 0.997253 },
            { x: 0.474265, y: 1 },
            { x: 0.345588, y: 0.975275 },
            { x: 0.198529, y: 0.906593 },
            { x: 0.227941, y: 0.554945 },
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
            { x: 0.002331, y: 0.380711 },
            { x: 0.011655, y: 0.296954 },
            { x: 0.058275, y: 0.15736 },
            { x: 0.130536, y: 0.058376 },
            { x: 0.207459, y: 0.01269 },
            { x: 0.251748, y: 0.002538 },
            { x: 0.4662, y: 0.045685 },
            { x: 0.634033, y: 0.106599 },
            { x: 0.827506, y: 0.527919 },
            { x: 0.834499, y: 0.705584 },
            { x: 0.331002, y: 0.725888 },
            { x: 0.165501, y: 0.616751 },
            { x: 0.041958, y: 0.497462 },
            { x: 0.004662, y: 0.426396 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.519814, y: 0.076142 },
            { x: 0.547786, y: 0.058376 },
            { x: 0.589744, y: 0.06599 },
            { x: 0.634033, y: 0.106599 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.207459, y: 0.01269 },
            { x: 0.706294, y: 0.203046 },
            { x: 0.785548, y: 0.327411 },
            { x: 0.841492, y: 0.426396 },
            { x: 0.827506, y: 0.527919 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.74359, y: 0.281726 },
            { x: 0.785548, y: 0.294416 },
            { x: 0.785548, y: 0.327411 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.834499, y: 0.705584 },
            { x: 0.955711, y: 0.796954 },
            { x: 0.995338, y: 0.883249 },
            { x: 0.967366, y: 0.951777 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.207459, y: 0.01269 },
            { x: 0.834499, y: 0.705584 },
            { x: 0.967366, y: 0.951777 },
            { x: 0.862471, y: 0.974619 },
            { x: 0.757576, y: 0.974619 },
            { x: 0.547786, y: 0.92132 },
            { x: 0.370629, y: 0.812183 },
            { x: 0.331002, y: 0.725888 },
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
            { x: 0.074364, y: 0.933036 },
            { x: 0.123288, y: 0.725446 },
            { x: 0.367906, y: 0.040179 },
            { x: 0.393346, y: 0.015625 },
            { x: 0.430528, y: 0.002232 },
            { x: 0.493151, y: 0.011161 },
            { x: 0.536204, y: 0.064732 },
            { x: 0.545988, y: 0.136161 },
            { x: 0.536204, y: 0.205357 },
            { x: 0.409002, y: 0.939732 },
            { x: 0.260274, y: 0.955357 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.11546, y: 0.555804 },
            { x: 0.131115, y: 0.330357 },
            { x: 0.176125, y: 0.272321 },
            { x: 0.234834, y: 0.207589 },
            { x: 0.277886, y: 0.205357 },
            { x: 0.51272, y: 0.270089 },
            { x: 0.592955, y: 0.332589 },
            { x: 0.637965, y: 0.4375 },
            { x: 0.847358, y: 0.995536 },
            { x: 0.1409, y: 0.647321 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.704501, y: 0.542411 },
            { x: 0.771037, y: 0.522321 },
            { x: 0.843444, y: 0.526786 },
            { x: 0.88454, y: 0.580357 },
            { x: 0.88454, y: 0.654018 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.661448, y: 0.529018 },
            { x: 0.704501, y: 0.542411 },
            { x: 0.88454, y: 0.654018 },
            { x: 0.921722, y: 0.685268 },
            { x: 0.998043, y: 0.787946 },
            { x: 0.982387, y: 0.84375 },
            { x: 0.962818, y: 0.872768 },
            { x: 0.847358, y: 0.995536 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.92955, y: 0.707589 },
            { x: 0.97456, y: 0.707589 },
            { x: 0.994129, y: 0.727679 },
            { x: 0.998043, y: 0.787946 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.1409, y: 0.647321 },
            { x: 0.336595, y: 0.147321 },
            { x: 0.393346, y: 0.015625 },
            { x: 0.51272, y: 0.270089 },
            { x: 0.847358, y: 0.995536 },
            { x: 0.796477, y: 0.997768 },
            { x: 0.636008, y: 0.966518 },
            { x: 0.142857, y: 0.698661 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.393346, y: 0.015625 },
            { x: 0.636008, y: 0.966518 },
            { x: 0.589041, y: 0.977679 },
            { x: 0.409002, y: 0.939732 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.393346, y: 0.015625 },
            { x: 0.260274, y: 0.955357 },
            { x: 0.183953, y: 0.986607 },
            { x: 0.127202, y: 0.982143 },
            { x: 0.074364, y: 0.933036 },
            { x: 0.142857, y: 0.698661 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.064579, y: 0.870536 },
            { x: 0.007828, y: 0.794643 },
            { x: 0.001957, y: 0.716518 },
            { x: 0.027397, y: 0.671875 },
            { x: 0.064579, y: 0.667411 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.074364, y: 0.933036 },
            { x: 0.064579, y: 0.870536 },
            { x: 0.064579, y: 0.667411 },
            { x: 0.123288, y: 0.725446 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.1409, y: 0.647321 },
            { x: 0.277886, y: 0.205357 },
            { x: 0.307241, y: 0.160714 },
            { x: 0.336595, y: 0.147321 },
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
    visualSize: { width: 304.5, height: 113.17 },
    physicsSize: { width: 304.5, height: 113.17 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.857768, y: 0.220588 },
            { x: 0.863239, y: 0.173529 },
            { x: 0.897155, y: 0.002941 },
            { x: 0.911379, y: 0.014706 },
            { x: 0.925602, y: 0.094118 },
            { x: 0.92779, y: 0.326471 },
            { x: 0.916849, y: 0.408824 },
            { x: 0.871991, y: 0.385294 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.001094, y: 0.573529 },
            { x: 0.007659, y: 0.514706 },
            { x: 0.053611, y: 0.455882 },
            { x: 0.721007, y: 0.255882 },
            { x: 0.857768, y: 0.220588 },
            { x: 0.871991, y: 0.385294 },
            { x: 0.796499, y: 0.464706 },
            { x: 0.121444, y: 0.735294 },
            { x: 0.039387, y: 0.752941 },
            { x: 0.020788, y: 0.723529 },
            { x: 0.004376, y: 0.641176 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.053611, y: 0.455882 },
            { x: 0.062363, y: 0.420588 },
            { x: 0.126915, y: 0.435294 },
            { x: 0.749453, y: 0.670588 },
            { x: 0.799781, y: 0.691176 },
            { x: 0.882932, y: 0.747059 },
            { x: 0.923414, y: 0.802941 },
            { x: 0.998906, y: 0.997059 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.923414, y: 0.802941 },
            { x: 0.977024, y: 0.770588 },
            { x: 0.991247, y: 0.814706 },
            { x: 0.998906, y: 0.997059 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.617068, y: 0.858824 },
            { x: 0.618162, y: 0.529412 },
            { x: 0.749453, y: 0.670588 },
            { x: 0.998906, y: 0.997059 },
            { x: 0.867615, y: 0.973529 },
            { x: 0.808534, y: 0.958824 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.225383, y: 0.276471 },
            { x: 0.320569, y: 0.170588 },
            { x: 0.350109, y: 0.182353 },
            { x: 0.618162, y: 0.529412 },
            { x: 0.617068, y: 0.858824 },
            { x: 0.577681, y: 0.885294 },
            { x: 0.432166, y: 0.920588 },
            { x: 0.335886, y: 0.888235 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.193654, y: 0.961765 },
            { x: 0.40372, y: 0.205882 },
            { x: 0.450766, y: 0.205882 },
            { x: 0.532823, y: 0.229412 },
            { x: 0.535011, y: 0.252941 },
            { x: 0.328228, y: 0.944118 },
            { x: 0.301969, y: 0.982353 },
            { x: 0.252735, y: 0.994118 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.618162, y: 0.529412 },
            { x: 0.335886, y: 0.888235 },
            { x: 0.193654, y: 0.961765 },
            { x: 0.149891, y: 0.891176 },
            { x: 0.128009, y: 0.814706 },
            { x: 0.121444, y: 0.735294 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.157549, y: 0.447059 },
            { x: 0.178337, y: 0.326471 },
            { x: 0.225383, y: 0.276471 },
            { x: 0.40372, y: 0.205882 },
            { x: 0.669584, y: 0.235294 },
            { x: 0.721007, y: 0.255882 },
            { x: 0.871991, y: 0.385294 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.258206, y: 0.191176 },
            { x: 0.247265, y: 0.102941 },
            { x: 0.249453, y: 0.055882 },
            { x: 0.260394, y: 0.035294 },
            { x: 0.333698, y: 0.047059 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.225383, y: 0.276471 },
            { x: 0.258206, y: 0.191176 },
            { x: 0.333698, y: 0.047059 },
            { x: 0.33698, y: 0.076471 },
            { x: 0.320569, y: 0.170588 },
          ],
        },
      ],
    },
    mass: 16.66,
    nextId: '12',
    points: 66,
  },
  {
    id: '12',
    name: '隐藏 QB',
    image: '12.png',
    sourceSize: { width: 483, height: 588 },
    visualSize: { width: 241.5, height: 294 },
    physicsSize: { width: 241.5, height: 294 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.004138, y: 0.798186 },
            { x: 0.484138, y: 0.017007 },
            { x: 0.49931, y: 0.004535 },
            { x: 0.529655, y: 0.001134 },
            { x: 0.57931, y: 0.011338 },
            { x: 0.697931, y: 0.078231 },
            { x: 0.746207, y: 0.117914 },
            { x: 0.797241, y: 0.185941 },
            { x: 0.844138, y: 0.265306 },
            { x: 0.89931, y: 0.402494 },
            { x: 0.944828, y: 0.517007 },
            { x: 0.991724, y: 0.665533 },
            { x: 0.991724, y: 0.684807 },
            { x: 0.977931, y: 0.701814 },
            { x: 0.031724, y: 0.829932 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.045517, y: 0.611111 },
            { x: 0.068966, y: 0.478458 },
            { x: 0.108966, y: 0.28458 },
            { x: 0.135172, y: 0.213152 },
            { x: 0.154483, y: 0.183673 },
            { x: 0.267586, y: 0.07483 },
            { x: 0.315862, y: 0.043084 },
            { x: 0.404138, y: 0.015873 },
            { x: 0.507586, y: 0.007937 },
            { x: 0.878621, y: 0.333333 },
            { x: 0.873103, y: 0.351474 },
            { x: 0.049655, y: 0.712018 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.08, y: 0.470522 },
            { x: 0.089655, y: 0.354875 },
            { x: 0.091034, y: 0.348073 },
            { x: 0.097931, y: 0.343537 },
            { x: 0.951724, y: 0.513605 },
            { x: 0.954483, y: 0.519274 },
            { x: 0.971034, y: 0.630385 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.507586, y: 0.007937 },
            { x: 0.977931, y: 0.701814 },
            { x: 0.997241, y: 0.734694 },
            { x: 0.90069, y: 0.842404 },
            { x: 0.822069, y: 0.901361 },
            { x: 0.748966, y: 0.941043 },
            { x: 0.657931, y: 0.975057 },
            { x: 0.583448, y: 0.992063 },
            { x: 0.514483, y: 1 },
            { x: 0.415172, y: 0.998866 },
            { x: 0.313103, y: 0.981859 },
            { x: 0.197241, y: 0.941043 },
            { x: 0.092414, y: 0.879819 },
            { x: 0.031724, y: 0.829932 },
            { x: 0.037241, y: 0.755102 },
            { x: 0.049655, y: 0.712018 },
          ],
        },
      ],
    },
    mass: 21.3,
    nextId: null,
    points: 78,
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
  baseRadius: 125,
  radiusPerSize: 1,
  maxRadius: 330,
  baseForce: 0.0275,
  forcePerSize: 0.000275,
  maxForce: 0.12,
  durationMs: 360,
  lineWidthCssPx: 2,
} as const
