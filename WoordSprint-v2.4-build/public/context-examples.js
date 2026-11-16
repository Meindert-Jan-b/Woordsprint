'use strict';
(function(root){
const contextExamples={
 'to eat':'Yesterday I [[ate]] an apple.',eat:'Yesterday I [[ate]] an apple.',
 'law-abiding':'She is a [[law-abiding]] citizen.',legal:'He needed [[legal]] advice.',illegal:'It is [[illegal]] to steal.',
 premises:'The company owns these [[premises]].',lawyer:'The [[lawyer]] helped her in court.',trial:'The [[trial]] began yesterday.',
 lawsuit:'They filed a [[lawsuit]] against the company.',court:'We went to [[court]] today.',solicitor:'A [[solicitor]] gave him legal advice.',
 barrister:'The [[barrister]] spoke to the judge.',wig:'He wore a traditional [[wig]].',witness:'A [[witness]] saw the accident.',
 eyewitness:'The [[eyewitness]] spoke to the police.','to witness':'She [[witnessed]] the accident.',
 'evident/obvious/apparent':'It was [[obvious]] that she was right.','to release':'The police [[released]] him yesterday.',
 apparently:'[[Apparently]], the train is delayed.',truth:'Please tell the [[truth]].',judge:'The [[judge]] listened carefully.',
 'to judge':'She [[judged]] his behaviour last week.',judgement:'The [[judgement]] was announced today.',fact:'That is a [[fact]].',
 'to defend':'The lawyer [[defended]] the suspect yesterday.',defence:'She prepared her [[defence]].',
 'the accused/the defendant':'The [[defendant]] appeared in court.','to acquit':'The jury [[acquitted]] him last week.',
 'to doubt':'I [[doubted]] his story yesterday.',doubt:'There is no [[doubt]] about it.',
 'le livre':'Je lis [[le livre]] aujourd’hui.',bonjour:'Elle dit [[bonjour]] à sa classe.',manger:'Je veux [[manger]] une pomme.'
};
if(typeof module==='object'&&module.exports)module.exports=contextExamples;
root.WoordContextExamples=contextExamples;
})(typeof globalThis!=='undefined'?globalThis:this);
