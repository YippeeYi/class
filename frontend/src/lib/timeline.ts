export function fixedTimelineChartScale(values: number[], baseMax: number, step: number) {
  const safeStep = Math.max(1, Number(step) || 1)
  const safeBaseMax = Math.max(safeStep, Number(baseMax) || safeStep)
  const dataMax = Math.max(0, ...values.map((value) => Number(value) || 0))
  const max = dataMax > safeBaseMax ? Math.ceil(dataMax / safeStep) * safeStep : safeBaseMax
  return {
    max,
    ticks: Array.from({ length: Math.round(max / safeStep) + 1 }, (_, index) => index * safeStep),
  }
}
