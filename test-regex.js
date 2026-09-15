const regex = /^[\[(【]?[A-Za-z][\])）】\.\、:：\-\s]*/;
console.log("A) 选项内容".replace(regex, ''));
console.log("A. ) 选项内容".replace(regex, ''));
console.log("A ) 选项内容".replace(regex, ''));
console.log("A)选项内容".replace(regex, ''));
