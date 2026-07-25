/**
 * Curve → SVG geometry, pure math. The inspector plots the MEASURED
 * f(width): x = viewport width, y = the property's value.
 */

export interface CurvePoint {
    width: number;
    value: number;
    x: number;
    y: number;
}

export interface CurveSvg {
    /** SVG path ("M x y L x y …"), empty when fewer than 1 point. */
    path: string;
    points: CurvePoint[];
    minValue: number;
    maxValue: number;
    width: number;
    height: number;
}

export function curveToSvg(curve: Map<number, number>, width = 300, height = 130, pad = 18): CurveSvg {
    const entries = [...curve.entries()].sort((a, b) => a[0] - b[0]);
    if (entries.length === 0) return { path: '', points: [], minValue: 0, maxValue: 0, width, height };

    const ws = entries.map(([w]) => w);
    const vs = entries.map(([, v]) => v);
    const wMin = ws[0];
    const wMax = ws[ws.length - 1];
    const vMin = Math.min(...vs);
    const vMax = Math.max(...vs);
    const wSpan = wMax - wMin || 1;
    const vSpan = vMax - vMin || 1;

    const points: CurvePoint[] = entries.map(([w, v]) => ({
        width: w,
        value: v,
        x: pad + ((w - wMin) / wSpan) * (width - 2 * pad),
        // SVG y grows downward: invert so bigger values sit higher.
        y: height - pad - ((v - vMin) / vSpan) * (height - 2 * pad),
    }));

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
    return { path, points, minValue: vMin, maxValue: vMax, width, height };
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}
