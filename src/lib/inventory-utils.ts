export const fmtNumber = (n: number) =>
  new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

/** يعرض الأرقام الصحيحة بدون كسور (18 بدل 18.00) ويعرض الكسور لو موجودة */
export const fmtQty = (n: number) => {
  const v = Number(n) || 0;
  const isInt = Number.isInteger(v);
  return new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 4,
  }).format(v);
};

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("ar-EG", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
