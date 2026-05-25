export function getDefaultArchiveLabel(date: Date = new Date()): string {
  const previousMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(previousMonth)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
