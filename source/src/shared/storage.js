export const getBest = () => {try{return Number(localStorage.getItem('sixseven-best'))||0;}catch{return 0;}};
export const setBest = n => {try{localStorage.setItem('sixseven-best',String(n));}catch{/* private mode */}};
