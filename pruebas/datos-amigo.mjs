/* ---------------------------------------------------------------------------
   La cartera de un usuario SIN servidor propio — el caso de los dos amigos de Victor.

   Es a propósito una cartera fea y variada: una de cada tipo de posición que la app sabe
   guardar, incluidas las que aún no tienen precio real (Iron Condor, Iron Fly, Calendar) y las
   que sí (short put, covered call, long call, Spread, PMCC, DC). También hay una cerrada, una
   con P&L manual forzado y liquidez, porque los bugs se esconden en los casos raros, no en el
   short put de manual.

   NINGUNA lleva marcas de opciones (optMarks): esa es justo la gracia. Esta cartera tiene que
   dar exactamente los mismos números hoy que dentro de veinte versiones.

   Si algún día hay que cambiar estos datos, hay que cambiar también la línea base a propósito
   (`npm run prueba -- --fijar`) y decir en el CHANGELOG por qué.
--------------------------------------------------------------------------- */

export const POSICIONES = [
  /* --- B0: liquidez --- */
  { id: "c1", tkr: "SGOV", block: 0, tipo: "Treasury ETF", nat: "ACC", qty: "200", entry: "100.30",
    last: "100.55", entryDate: "2026-01-15", broker: "IBKR", comision: "0" },

  /* --- B1: acciones --- */
  { id: "a1", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", entry: "112.40",
    last: "168.20", entryDate: "2026-02-10", broker: "IBKR", comision: "1" },
  { id: "a2", tkr: "GOOGL", block: 1, tipo: "Long Stock", nat: "ACC", qty: "50", entry: "190.00",
    last: "171.30", entryDate: "2026-03-02", broker: "IBKR", comision: "1" },
  /* una cerrada: no debe contar en el P&L abierto */
  { id: "a3", tkr: "FN", block: 1, tipo: "Long Stock", nat: "ACC", qty: "20", entry: "560.00",
    last: "564.73", closed: true, closePrice: "730.00", closeDate: "2026-07-20",
    entryDate: "2026-01-05", broker: "IBKR", comision: "1" },

  /* --- B2: income, una pata --- */
  { id: "o1", tkr: "TMDX", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
    strike: "70", expiry: "2026-09-18", prima: "7.72", last: "76.49",
    entryDate: "2026-06-01", broker: "IBKR", comision: "1" },
  { id: "o2", tkr: "NVDA", block: 2, tipo: "Covered Call", nat: "CRED", right: "C", qty: "100",
    strike: "175", expiry: "2026-09-18", prima: "2.40", last: "168.20",
    entryDate: "2026-07-01", broker: "IBKR", comision: "1" },
  { id: "o3", tkr: "AMD", block: 2, tipo: "Long Call", nat: "DEB", right: "C", qty: "100",
    strike: "150", expiry: "2027-01-15", prima: "18.50", last: "170.00",
    entryDate: "2026-05-10", broker: "IBKR", comision: "1" },
  /* PMCC: dos patas, dos vencimientos */
  { id: "o4", tkr: "MSFT", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100",
    strike: "540", expiry: "2026-09-18", prima: "6.10", last: "512.40",
    long: { strike: "420", expiry: "2027-06-18", prima: "112.00" },
    entryDate: "2026-04-01", broker: "IBKR", comision: "2" },

  /* --- B3: estructuras --- */
  /* vertical, las dos patas vivas */
  { id: "v1", tkr: "SPY", block: 3, tipo: "Spread", nat: "DEF", right: "P", qty: "100",
    expiry: "2026-09-18", sK: "560", sP: "4.20", lK: "550", lP: "1.80", pnl: "310",
    last: "565.20", entryDate: "2026-08-01", broker: "IBKR", comision: "2" },
  /* vertical con la pata larga ya cerrada */
  { id: "v2", tkr: "SPY", block: 3, tipo: "Spread", nat: "DEF", right: "C", qty: "100", noLong: true,
    expiry: "2026-10-16", sK: "600", sP: "3.10", lK: "610", lP: "1.20", pnl: "-140",
    last: "565.20", entryDate: "2026-08-05", broker: "IBKR", comision: "2" },
  /* DC: cuatro patas, dos vencimientos */
  { id: "d1", tkr: "AMD", block: 3, tipo: "DC", nat: "DEF", qty: "100",
    expiry: "2026-09-18", last: "170.00", pnl: "85",
    dcdd: { expiryLong: "2026-10-16", legs: { sp: { k: "160", p: "2.00" }, sc: { k: "180", p: "2.20" },
                                              lp: { k: "160", p: "4.00" }, lc: { k: "180", p: "4.30" } } },
    entryDate: "2026-08-01", broker: "IBKR", comision: "4" },
  /* las que NO guardan patas: siguen y seguirán a mano */
  { id: "ic1", tkr: "SPX", block: 3, tipo: "Iron Condor", nat: "DEF", qty: "100",
    expiry: "2026-09-18", pnl: "-220", last: "6120", entryDate: "2026-08-02", broker: "IBKR", comision: "4" },
  { id: "if1", tkr: "QQQ", block: 3, tipo: "Iron Fly", nat: "DEF", qty: "100",
    expiry: "2026-09-18", pnl: "175", last: "498.10", entryDate: "2026-08-03", broker: "IBKR", comision: "4" },
  { id: "cal1", tkr: "META", block: 3, tipo: "Calendar", nat: "DEF", qty: "100",
    expiry: "2026-09-18", pnl: "40", last: "702.00", entryDate: "2026-08-04", broker: "IBKR", comision: "2" },
  /* una con el P&L puesto a mano por el usuario aunque podría ser automático */
  { id: "m1", tkr: "PLTR", block: 3, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
    strike: "150", expiry: "2026-09-18", prima: "5.00", last: "162.30", pnlModo: "MANUAL", pnl: "260",
    entryDate: "2026-07-15", broker: "IBKR", comision: "1" },
];

export const CUENTAS = { IBKR: { cash: "38500", margin: "12000", excessLiq: "26000" } };

/* precios del subyacente que devuelve el Finnhub simulado — fijos, para que el resultado no
   dependa del día en que se ejecute la prueba */
export const COTIZACIONES = {
  SGOV: 100.55, NVDA: 168.20, GOOGL: 171.30, FN: 564.73, TMDX: 76.49, AMD: 170.00,
  MSFT: 512.40, SPY: 565.20, SPX: 6120, QQQ: 498.10, META: 702.00, PLTR: 162.30,
};

/* el reloj se congela en esta fecha: hay cifras que dependen de los días a vencimiento, y una
   prueba que cambia de resultado cada mañana no sirve para nada */
export const HOY = "2026-08-14T12:00:00.000Z";
