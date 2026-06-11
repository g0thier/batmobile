declare module 'three' {
  export class Euler {
    constructor(x?: number, y?: number, z?: number, order?: string);
  }

  export class Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;

    setFromEuler(euler: Euler): Quaternion;
  }

  export const MathUtils: {
    degToRad(degrees: number): number;
  };
}
