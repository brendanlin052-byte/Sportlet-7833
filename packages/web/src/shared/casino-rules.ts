export const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export const slotSymbols = [
  { name: "Ball", mark: "●", multiplier: 5 }, { name: "Star", mark: "★", multiplier: 8 },
  { name: "Diamond", mark: "◆", multiplier: 10 }, { name: "Crown", mark: "♛", multiplier: 12 },
  { name: "Seven", mark: "7", multiplier: 15 },
];
export function rouletteMultiplier(number: number, choice: string) {
  if (choice.startsWith("number:")) return number === Number(choice.slice(7)) ? 36 : 0;
  if (number === 0) return 0;
  const win = choice === "red" ? redNumbers.includes(number) : choice === "black" ? !redNumbers.includes(number)
    : choice === "odd" ? number % 2 === 1 : choice === "even" ? number % 2 === 0 : false;
  return win ? 2 : 0;
}
export function slotsMultiplier(reels: number[]) {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return slotSymbols[reels[0]!]!.multiplier;
  return new Set(reels).size === 2 ? 1 : 0;
}