# temi.py — QuizNCC
#
# Assegna a ogni domanda l'argomento della prova scritta di Milano:
#   geo = geografia della Lombardia · leg = legislazione nazionale/regionale/aeroportuale
#   reg = regolamento del Comune di Milano (comportamento in servizio) · en/fr = lingua.
# Prima le regole a parole chiave, poi OVERRIDE per i casi decisi a mano.

import re

GEO = r"""\bSS\b|\bA\s?\d{1,2}\b|autostrad|tangenzial|lago|fiume|valle|\bval\b|valt|valc|valch|passo|monte|montagn|
capoluogo|abitanti|provincia di|province|comune di|si trova|collega|attravers|passa per|confina|
museo|castello|basilica|duomo|chiesa|abbazia|certosa|torre|villa|palazzo|teatro|monument|santuario|
ferrovi|stazione|metropolitan|tranvi|navigli|naviga|aeroporto di|malpensa|linate|orio|bergamo|brescia|como|varese|
sondrio|lecco|lodi|pavia|cremona|mantova|monza|lombard|isola|pianura|brianza|valtellina|ticino|adda|oglio|mincio|
lambro|olona|serio|brembo|chiavenna|stelvio|tonale|gavia|spluga|sempione|km|chilometr|termal|turistic|produzione|
prodotto tipico|famos|riviera|garda|iseo|maggiore|ceresio|lugano|svizzer|confine|sciistic|parco"""
LEG = r"""legge|\bl\.r\.|\bL\.\s?\d|regional|regione|\bart\.|articolo|decreto|d\.?lgs|dgr|delibera|
licenz|autorizzazion|ruolo|camera di commercio|cciaa|iscrizion|cancellazion|requisit|commission|
sanzion|sospensione|revoca|decadenza|trasferimento|cumulo|titolar|sostituto|collaboratore familiare|
concorso|bando|graduatoria|natanti|trazione animale|cap\b|abilitazione professionale|cqc|
bacino|aeroportual|regolamento regionale|adeguamento tariffario|programmazione|contingent|
comunità europea|unione europea|stato membro|cittadinanza|residenza|assicura|responsabilità civile|
codice della strada|circolazione|patente|revisione|immatricol|omologa|carta di circolazione|
ncc\b|noleggio con conducente|rimessa|sede|territorio del comune|fuori dal comune|ente|ministero|prefett"""
REG = r"""tassametro|corsa|utente|cliente|passegger|bagagl|posteggi|parcheggi|turn|tabella|tariff|supplement|
ricevuta|oggett|smarrit|contrassegno|luce|insegna|targa|decor|vestir|comportament|dover|obblig|vietat|
può rifiutare|rifiutare|fumar|animal|cane|guida|disabil|invalid|carrozz|radiotaxi|radio|chiamata|prenotaz|
accompagn|bambin|prezzo|pagamento|pagare|importo|percorso più breve|itinerario|destinazione|
posto di lavoro|inizio|termine del servizio|fine corsa|vettura di piazza|taxi deve|conducente deve|
conducente di taxi|conducente del taxi|conducenti di taxi|tassist|servizio taxi|vettura|autovettura|
ciclomotore|sedile|cintur|estintore|marmitt|tassametr|scontrino|iva|corrispettiv|mancia|attesa"""

def tema(d):
    if 869 <= d["n"] <= 949: return "en"
    if d["n"] >= 950: return "fr"
    if d["n"] in OVERRIDE: return OVERRIDE[d["n"]]
    txt = (d["q"] + " " + " ".join(d["a"])).lower()
    q = d["q"].lower()
    s = {k: len(re.findall(p, txt, re.I | re.X)) for k, p in (("geo", GEO), ("leg", LEG), ("reg", REG))}
    # la domanda pesa più delle risposte
    for k, p in (("geo", GEO), ("leg", LEG), ("reg", REG)):
        s[k] += 2 * len(re.findall(p, q, re.I | re.X))
    best = max(s, key=s.get)
    return best if s[best] > 0 else "?"

# Decisi a mano rileggendo tutte le 845 domande (08/09/2026).
# Criterio Milano: tutto ciò che è aeroportuale (DGR, tariffe, banchine, sosta a pagamento) → leg;
# commissione tecnico-consultiva, collaboratori familiari, visite di controllo, turni, supplementi → reg.
def _set(dst, t, nums):
    for n in nums: dst[n] = t
OVERRIDE = {}
_set(OVERRIDE, "geo", [83, 252, 348, 380, 428, 433, 438, 442, 444, 448, 450, 455, 458, 479, 480, 486, 495, 505,
    506, 569, 693, 720, 739, 827])
_set(OVERRIDE, "leg", [6, 9, 42, 45, 46, 49, 50, 53, 54, 77, 89, 90, 93, 98, 105, 109, 110, 130, 134, 137, 161,
    162, 170, 189, 190, 206, 221, 241, 250, 258, 270, 277, 509, 510, 511, 512, 520, 529, 531, 533, 534, 539,
    546, 547, 548, 555, 582, 621, 624, 625, 629, 633, 634, 635, 636, 637, 638, 639, 641, 675, 699, 703, 726,
    797, 820, 855, 858, 859])
_set(OVERRIDE, "reg", [146, 181, 194, 197, 218, 230, 233, 238, 242, 261, 273, 274, 278, 281, 285, 286, 289, 290,
    293, 294, 298, 299, 302, 303, 306, 307, 310, 311, 314, 315, 318, 319, 322, 323, 326, 327, 330, 331, 334,
    335, 338, 339, 342, 589, 614, 617, 619, 646])
