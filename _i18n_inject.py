import json
p = r'C:\Users\erhan\Downloads\Claude\cbam-risk-calculator.html'
h = open(p,encoding='utf-8').read()

# Dictionary: key -> {lang: text}
LANGS = ["tr","en","de","fr","es","it"]
LANG_NAMES = {"tr":"Türkçe","en":"English","de":"Deutsch","fr":"Français","es":"Español","it":"Italiano"}

I18N = {
 "page_title": {
  "tr":"CBAM Risk Hesaplayıcı | Voltfox",
  "en":"CBAM Risk Calculator | Voltfox",
  "de":"CBAM-Risikorechner | Voltfox",
  "fr":"Calculateur de risque MACF | Voltfox",
  "es":"Calculadora de riesgo MAFC | Voltfox",
  "it":"Calcolatore di rischio CBAM | Voltfox",
 },
 "header_tag": {
  "tr":"CBAM Risk Hesaplayıcı · Referans Değerler v2026-02-04",
  "en":"CBAM Risk Calculator · Default Values v2026-02-04",
  "de":"CBAM-Risikorechner · Standardwerte v2026-02-04",
  "fr":"Calculateur de risque MACF · Valeurs par défaut v2026-02-04",
  "es":"Calculadora de riesgo MAFC · Valores predeterminados v2026-02-04",
  "it":"Calcolatore di rischio CBAM · Valori predefiniti v2026-02-04",
 },
 "h1_a": {"tr":"AB Komisyonu","en":"European Commission","de":"EU-Kommission","fr":"Commission européenne","es":"Comisión Europea","it":"Commissione europea"},
 "h1_b": {
  "tr":"resmi referans değerleri",
  "en":"official default values",
  "de":"offizielle Standardwerte",
  "fr":"valeurs par défaut officielles",
  "es":"valores predeterminados oficiales",
  "it":"valori predefiniti ufficiali",
 },
 "h1_c": {
  "tr":"ile gerçek CBAM riskinizi hesaplayın",
  "en":"— calculate your real CBAM exposure",
  "de":"— berechnen Sie Ihr tatsächliches CBAM-Risiko",
  "fr":"— calculez votre exposition MACF réelle",
  "es":"— calcule su exposición MAFC real",
  "it":"— calcola la tua reale esposizione CBAM",
 },
 "lede": {
  "tr":"Menşe ülke ve KN (CN) kodu seçin; saatlik Scope 2 muhasebesi ve 24/7 yenilenebilir enerji eşleştirme oranınız ile ürün başına gömülü emisyon faktörünüzü, yıllık CBAM yükümlülüğünüzü ve Voltfox 24/7 CFE platformuyla elde edebileceğiniz tasarrufu hesaplayın. Referans (default) değerler AB Komisyonu'nun 4 Şubat 2026 tarihli Uygulama Tüzüğü Ek IV tablosundan alınmıştır.",
  "en":"Select country of origin and CN code; calculate your embedded emission factor per unit, annual CBAM liability and savings via Voltfox's 24/7 CFE platform — using hourly Scope 2 accounting and your 24/7 renewable matching rate. Default values are sourced from Annex IV of the European Commission's CBAM Implementing Regulation (published 4 Feb 2026).",
  "de":"Wählen Sie Ursprungsland und KN-Code; ermitteln Sie Ihren produktspezifischen eingebetteten Emissionsfaktor, die jährliche CBAM-Pflicht und Ihre Einsparungen mit der 24/7-CFE-Plattform von Voltfox — auf Basis stündlicher Scope-2-Bilanzierung und Ihrer 24/7-Erneuerbaren-Matching-Rate. Standardwerte stammen aus Anhang IV der CBAM-Durchführungsverordnung (veröffentlicht am 4. Februar 2026).",
  "fr":"Sélectionnez le pays d'origine et le code NC ; calculez votre facteur d'émission intégré par unité, votre obligation MACF annuelle et vos économies via la plateforme 24/7 CFE de Voltfox — sur la base d'une comptabilité Scope 2 horaire et de votre taux d'appariement renouvelable 24/7. Les valeurs par défaut proviennent de l'annexe IV du règlement d'exécution MACF de la Commission européenne (publié le 4 février 2026).",
  "es":"Seleccione país de origen y código NC; calcule su factor de emisión incorporada por unidad, la obligación MAFC anual y los ahorros con la plataforma 24/7 CFE de Voltfox — usando contabilidad Scope 2 horaria y su tasa de coincidencia renovable 24/7. Los valores predeterminados provienen del Anexo IV del Reglamento de Ejecución MAFC de la Comisión Europea (publicado el 4 de febrero de 2026).",
  "it":"Seleziona il paese di origine e il codice NC; calcola il tuo fattore di emissione incorporata per unità, l'obbligo CBAM annuo e i risparmi con la piattaforma 24/7 CFE di Voltfox — usando contabilità Scope 2 oraria e il tuo tasso di matching rinnovabile 24/7. I valori predefiniti provengono dall'Allegato IV del Regolamento di esecuzione CBAM della Commissione europea (pubblicato il 4 febbraio 2026).",
 },
 "card1_title": {
  "tr":"Ürün, menşe ve operasyonel parametreler",
  "en":"Product, origin and operational parameters",
  "de":"Produkt-, Ursprungs- und Betriebsparameter",
  "fr":"Produit, origine et paramètres opérationnels",
  "es":"Producto, origen y parámetros operativos",
  "it":"Prodotto, origine e parametri operativi",
 },
 "card1_sub": {
  "tr":"Tüm hesaplama tarayıcınızda gerçekleşir; veriler hiçbir sunucuya iletilmez.",
  "en":"All calculations run locally in your browser; no data is sent to any server.",
  "de":"Alle Berechnungen erfolgen lokal in Ihrem Browser; keine Daten werden an Server gesendet.",
  "fr":"Tous les calculs s'exécutent localement dans votre navigateur ; aucune donnée n'est transmise à un serveur.",
  "es":"Todos los cálculos se realizan localmente en su navegador; no se envían datos a ningún servidor.",
  "it":"Tutti i calcoli vengono eseguiti localmente nel browser; nessun dato viene inviato ai server.",
 },
 "s1": {"tr":"1 · Ürün ve menşe ülke","en":"1 · Product and country of origin","de":"1 · Produkt und Ursprungsland","fr":"1 · Produit et pays d'origine","es":"1 · Producto y país de origen","it":"1 · Prodotto e paese di origine"},
 "lbl_country": {"tr":"Menşe ülke","en":"Country of origin","de":"Ursprungsland","fr":"Pays d'origine","es":"País de origen","it":"Paese di origine"},
 "lbl_category": {"tr":"CBAM sektörü (filtre)","en":"CBAM sector (filter)","de":"CBAM-Sektor (Filter)","fr":"Secteur MACF (filtre)","es":"Sector MAFC (filtro)","it":"Settore CBAM (filtro)"},
 "opt_all": {"tr":"Tüm sektörler","en":"All sectors","de":"Alle Sektoren","fr":"Tous les secteurs","es":"Todos los sectores","it":"Tutti i settori"},
 "lbl_product": {"tr":"KN (CN) kodu / ürün","en":"CN code / product","de":"KN-Code / Produkt","fr":"Code NC / produit","es":"Código NC / producto","it":"Codice NC / prodotto"},
 "hint_product": {
  "tr":"Seçilen ülke için AB CBAM Uygulama Tüzüğü'ndeki resmi referans değerler kullanılır.",
  "en":"Official default values from the EU CBAM Implementing Regulation are applied for the selected country.",
  "de":"Es werden die offiziellen Standardwerte der CBAM-Durchführungsverordnung für das gewählte Land angewendet.",
  "fr":"Les valeurs par défaut officielles du règlement d'exécution MACF sont appliquées pour le pays sélectionné.",
  "es":"Se aplican los valores predeterminados oficiales del Reglamento de Ejecución MAFC para el país seleccionado.",
  "it":"Per il paese selezionato vengono applicati i valori predefiniti ufficiali del Regolamento di esecuzione CBAM.",
 },
 "s2": {"tr":"2 · AB ithalat hacmi","en":"2 · EU import volume","de":"2 · EU-Importvolumen","fr":"2 · Volume d'importation UE","es":"2 · Volumen de importación a la UE","it":"2 · Volume di importazione UE"},
 "lbl_volume": {"tr":"AB'ye yıllık ihracat hacmi (ton / MWh)","en":"Annual export volume to the EU (tonnes / MWh)","de":"Jährliches Exportvolumen in die EU (Tonnen / MWh)","fr":"Volume annuel d'exportation vers l'UE (tonnes / MWh)","es":"Volumen anual de exportación a la UE (toneladas / MWh)","it":"Volume annuo di esportazione verso l'UE (tonnellate / MWh)"},
 "lbl_period": {"tr":"Referans değer mark-up dönemi","en":"Default value mark-up period","de":"Standardwert-Aufschlagsperiode","fr":"Période de majoration de la valeur par défaut","es":"Período de recargo del valor predeterminado","it":"Periodo di mark-up del valore predefinito"},
 "opt_v2026": {"tr":"2026 (+%10 mark-up)","en":"2026 (+10% mark-up)","de":"2026 (+10% Aufschlag)","fr":"2026 (+10% majoration)","es":"2026 (+10% recargo)","it":"2026 (+10% mark-up)"},
 "opt_v2027": {"tr":"2027 (+%20 mark-up)","en":"2027 (+20% mark-up)","de":"2027 (+20% Aufschlag)","fr":"2027 (+20% majoration)","es":"2027 (+20% recargo)","it":"2027 (+20% mark-up)"},
 "opt_v2028": {"tr":"2028 ve sonrası (+%30 mark-up)","en":"2028 and beyond (+30% mark-up)","de":"2028 und später (+30% Aufschlag)","fr":"2028 et au-delà (+30% majoration)","es":"2028 en adelante (+30% recargo)","it":"2028 e oltre (+30% mark-up)"},
 "no_data": {
  "tr":"Seçilen menşe ülke için bu KN kodunda yayımlanmış resmi referans değer bulunmuyor. Doğrulanmış veri sağlanmadığı sürece AB Komisyonu, başka bir kaynak ülkenin değerini veya AB iç pazarındaki en yüksek değeri uygular. Aşağıda kullanılan değer fallback olarak gösteriliyor.",
  "en":"No official default value has been published for this CN code under the selected country of origin. Unless verified data is provided, the EU Commission applies the value of another source country or the highest EU domestic value. The value shown below is used as a fallback.",
  "de":"Für diesen KN-Code unter dem gewählten Ursprungsland wurde kein offizieller Standardwert veröffentlicht. Solange keine verifizierten Daten vorliegen, wendet die EU-Kommission den Wert eines anderen Ursprungslandes oder den höchsten EU-Binnenwert an. Der unten angezeigte Wert dient als Fallback.",
  "fr":"Aucune valeur par défaut officielle n'a été publiée pour ce code NC pour le pays d'origine sélectionné. Sans données vérifiées, la Commission européenne applique la valeur d'un autre pays source ou la valeur intérieure UE la plus élevée. La valeur ci-dessous est utilisée comme valeur de repli.",
  "es":"No se ha publicado un valor predeterminado oficial para este código NC en el país de origen seleccionado. Sin datos verificados, la Comisión Europea aplica el valor de otro país de origen o el valor interno más alto de la UE. El valor que aparece a continuación se utiliza como alternativa.",
  "it":"Per questo codice NC nel paese di origine selezionato non è stato pubblicato un valore predefinito ufficiale. In assenza di dati verificati, la Commissione UE applica il valore di un altro paese di origine o il valore interno UE più alto. Il valore mostrato di seguito è utilizzato come fallback.",
 },
 "s3": {"tr":"3 · Scope 2 (elektrik) — gömülü dolaylı emisyonlar","en":"3 · Scope 2 (electricity) — embedded indirect emissions","de":"3 · Scope 2 (Strom) — eingebettete indirekte Emissionen","fr":"3 · Scope 2 (électricité) — émissions indirectes intégrées","es":"3 · Alcance 2 (electricidad) — emisiones indirectas incorporadas","it":"3 · Scope 2 (elettricità) — emissioni indirette incorporate"},
 "s3_lead_a": {
  "tr":"Bu KN kodu için AB referans tablosunda gömülü dolaylı emisyon",
  "en":"For this CN code, the EU default table reports embedded indirect emissions of",
  "de":"Für diesen KN-Code weist die EU-Standardtabelle eingebettete indirekte Emissionen von",
  "fr":"Pour ce code NC, la table de référence UE indique des émissions indirectes intégrées de",
  "es":"Para este código NC, la tabla de referencia UE indica emisiones indirectas incorporadas de",
  "it":"Per questo codice NC, la tabella di riferimento UE indica emissioni indirette incorporate di",
 },
 "s3_lead_b": {
  "tr":"tCO₂ / ürün olarak yayımlanmış. Yenilenebilir enerji eşleştirmeniz bu değeri eşleşen oranda sıfıra indirir.",
  "en":"tCO₂ per unit. Your renewable energy matching reduces this value to zero proportionally to the match rate.",
  "de":"tCO₂ pro Einheit aus. Ihr Erneuerbaren-Matching reduziert diesen Wert anteilig zur Match-Quote auf null.",
  "fr":"tCO₂ par unité. Votre appariement avec les énergies renouvelables réduit cette valeur à zéro proportionnellement au taux d'appariement.",
  "es":"tCO₂ por unidad. Su emparejamiento con energía renovable reduce este valor a cero en proporción a la tasa de coincidencia.",
  "it":"tCO₂ per unità. Il tuo matching con energia rinnovabile riduce questo valore a zero in proporzione al tasso di matching.",
 },
 "lbl_elec": {"tr":"Birim ürün başına elektrik tüketimi (MWh / ürün)","en":"Electricity consumption per unit of product (MWh / unit)","de":"Stromverbrauch pro Produkteinheit (MWh / Einheit)","fr":"Consommation électrique par unité de produit (MWh / unité)","es":"Consumo eléctrico por unidad de producto (MWh / unidad)","it":"Consumo elettrico per unità di prodotto (MWh / unità)"},
 "hint_elec": {
  "tr":"KN kodu seçildiğinde tipik sektörel değer otomatik doldurulur; gerçek değerinizi girebilirsiniz.",
  "en":"A typical sector-specific value is auto-filled when a CN code is selected; you can override it with your real value.",
  "de":"Bei Auswahl eines KN-Codes wird ein sektortypischer Wert automatisch eingetragen; Sie können ihn mit Ihrem realen Wert überschreiben.",
  "fr":"Une valeur typique du secteur est pré-remplie à la sélection d'un code NC ; vous pouvez la remplacer par votre valeur réelle.",
  "es":"Al seleccionar un código NC se rellena automáticamente un valor sectorial típico; puede sobrescribirlo con su valor real.",
  "it":"Selezionando un codice NC viene precompilato un valore tipico del settore; puoi sostituirlo con il tuo valore reale.",
 },
 "lbl_grid": {"tr":"Şebeke emisyon faktörü (tCO₂ / MWh)","en":"Grid emission factor (tCO₂ / MWh)","de":"Netz-Emissionsfaktor (tCO₂ / MWh)","fr":"Facteur d'émission du réseau (tCO₂ / MWh)","es":"Factor de emisión de la red (tCO₂ / MWh)","it":"Fattore di emissione di rete (tCO₂ / MWh)"},
 "hint_grid": {
  "tr":"Türkiye 2024: ~0,42 · AB ortalaması: ~0,23 tCO₂/MWh.",
  "en":"Türkiye 2024: ~0.42 · EU average: ~0.23 tCO₂/MWh.",
  "de":"Türkei 2024: ~0,42 · EU-Durchschnitt: ~0,23 tCO₂/MWh.",
  "fr":"Türkiye 2024 : ~0,42 · Moyenne UE : ~0,23 tCO₂/MWh.",
  "es":"Türkiye 2024: ~0,42 · Media UE: ~0,23 tCO₂/MWh.",
  "it":"Türkiye 2024: ~0,42 · Media UE: ~0,23 tCO₂/MWh.",
 },
 "lbl_renew": {"tr":"Yıllık yenilenebilir enerji hacminiz (MWh) — kendi üretim, PPA veya I-REC","en":"Your annual renewable energy volume (MWh) — own generation, PPA or I-REC","de":"Ihre jährliche Erneuerbaren-Menge (MWh) — Eigenerzeugung, PPA oder I-REC","fr":"Votre volume annuel d'énergie renouvelable (MWh) — production propre, PPA ou I-REC","es":"Su volumen anual de energía renovable (MWh) — generación propia, PPA o I-REC","it":"Volume annuo di energia rinnovabile (MWh) — autoproduzione, PPA o I-REC"},
 "hint_renew": {
  "tr":"Sahip olduğunuz veya uzun vadeli PPA / I-REC / EKS sertifikasıyla sözleşmeli yenilenebilir enerji hacmi.",
  "en":"Renewable energy you own or contract via long-term PPA / I-REC / EAC certificates.",
  "de":"Erneuerbare Energie, die Sie besitzen oder über langfristige PPAs / I-RECs / EACs vertraglich beziehen.",
  "fr":"Énergie renouvelable que vous possédez ou contractez via des PPA / I-REC / AEC à long terme.",
  "es":"Energía renovable propia o contratada mediante PPA / I-REC / EAC a largo plazo.",
  "it":"Energia rinnovabile di proprietà o contrattualizzata tramite PPA / I-REC / EAC a lungo termine.",
 },
 "match_badge": {"tr":"⚡ EŞLEŞTİRME METODOLOJİSİ","en":"⚡ MATCHING METHODOLOGY","de":"⚡ MATCHING-METHODE","fr":"⚡ MÉTHODE D'APPARIEMENT","es":"⚡ METODOLOGÍA DE COINCIDENCIA","it":"⚡ METODOLOGIA DI MATCHING"},
 "match_tag": {
  "tr":"CBAM Scope 2 yükümlülüğünüzü belirleyen kritik faktör",
  "en":"The critical factor that determines your CBAM Scope 2 liability",
  "de":"Der entscheidende Faktor für Ihre CBAM-Scope-2-Pflicht",
  "fr":"Le facteur critique qui détermine votre obligation MACF Scope 2",
  "es":"El factor crítico que determina su obligación MAFC de Alcance 2",
  "it":"Il fattore critico che determina il tuo obbligo CBAM Scope 2",
 },
 "match_lead_a": {"tr":"AB Komisyonu 2027'den itibaren","en":"Starting in 2027, the European Commission is phasing in","de":"Ab 2027 führt die EU-Kommission","fr":"À partir de 2027, la Commission européenne met en œuvre","es":"A partir de 2027, la Comisión Europea implementará","it":"Dal 2027 la Commissione europea introduce progressivamente"},
 "match_lead_b": {"tr":"saatlik (24/7) eşleştirme","en":"hourly 24/7 matching","de":"stündliches 24/7-Matching","fr":"l'appariement horaire 24/7","es":"el emparejamiento horario 24/7","it":"il matching orario 24/7"},
 "match_lead_c": {
  "tr":"zorunluluğunu kademeli olarak yürürlüğe koyuyor. Yıllık ortalama yenilenebilir sertifikalar artık CBAM beyanlarında savunulabilir kanıt olarak kabul edilmiyor.",
  "en":"as a requirement. Annual-average renewable certificates are no longer accepted as defensible evidence in CBAM declarations.",
  "de":"als Anforderung ein. Jährliche Durchschnitts-Zertifikate werden in CBAM-Erklärungen nicht mehr als belastbarer Nachweis akzeptiert.",
  "fr":"comme exigence. Les certificats renouvelables en moyenne annuelle ne sont plus acceptés comme preuve défendable dans les déclarations MACF.",
  "es":"como requisito. Los certificados de renovables en promedio anual ya no se aceptan como prueba defendible en las declaraciones MAFC.",
  "it":"come requisito. I certificati rinnovabili a media annuale non sono più accettati come prova difendibile nelle dichiarazioni CBAM.",
 },
 "opt_annual_t": {"tr":"Yıllık ortalama eşleştirme","en":"Annual-average matching","de":"Jährliches Durchschnitts-Matching","fr":"Appariement en moyenne annuelle","es":"Coincidencia por promedio anual","it":"Matching a media annuale"},
 "opt_annual_s": {"tr":"Klasik EKS / I-REC · Greenwashing riski yüksek","en":"Classic EAC / I-REC · High greenwashing risk","de":"Klassische EAC / I-REC · Hohes Greenwashing-Risiko","fr":"AEC / I-REC classiques · Risque de greenwashing élevé","es":"EAC / I-REC clásicos · Alto riesgo de greenwashing","it":"EAC / I-REC classici · Alto rischio di greenwashing"},
 "opt_annual_p": {"tr":"Eski yöntem","en":"Legacy","de":"Veraltet","fr":"Obsolète","es":"Heredado","it":"Obsoleto"},
 "opt_hourly_t": {"tr":"Saatlik 24/7 karbonsuz enerji (CFE)","en":"Hourly 24/7 carbon-free energy (CFE)","de":"Stündliche 24/7 kohlenstofffreie Energie (CFE)","fr":"Énergie sans carbone horaire 24/7 (CFE)","es":"Energía libre de carbono 24/7 horaria (CFE)","it":"Energia carbon-free oraria 24/7 (CFE)"},
 "opt_hourly_s": {"tr":"Voltfox metodolojisi · Saat ve lokasyon bazında doğrulanmış kanıt","en":"Voltfox methodology · Hour-and-location-verified evidence","de":"Voltfox-Methodik · Stunden- und standortverifizierter Nachweis","fr":"Méthodologie Voltfox · Preuve vérifiée par heure et lieu","es":"Metodología Voltfox · Evidencia verificada por hora y ubicación","it":"Metodologia Voltfox · Prova verificata per ora e luogo"},
 "opt_hourly_p": {"tr":"Önerilen","en":"Recommended","de":"Empfohlen","fr":"Recommandé","es":"Recomendado","it":"Consigliato"},
 "meter_head": {"tr":"Eşleştirme oranınız","en":"Your matching rate","de":"Ihre Matching-Quote","fr":"Votre taux d'appariement","es":"Su tasa de coincidencia","it":"Il tuo tasso di matching"},
 "scale_0": {"tr":"%0 · Tamamı şebeke karışımı","en":"0% · Full grid mix","de":"0% · Vollständiger Netzmix","fr":"0% · Mix réseau complet","es":"0% · Mezcla de red completa","it":"0% · Mix di rete completo"},
 "scale_85": {"tr":"%85+ · Voltfox müşteri ortalaması","en":"85%+ · Voltfox customer average","de":"85%+ · Voltfox-Kundendurchschnitt","fr":"85%+ · Moyenne client Voltfox","es":"85%+ · Promedio de clientes Voltfox","it":"85%+ · Media clienti Voltfox"},
 "scale_100": {"tr":"%100 · 24/7 tam karbonsuz","en":"100% · 24/7 fully carbon-free","de":"100% · 24/7 vollständig kohlenstofffrei","fr":"100% · 24/7 entièrement sans carbone","es":"100% · 24/7 totalmente libre de carbono","it":"100% · 24/7 totalmente carbon-free"},
 "bul_low_t": {"tr":"Düşük eşleşme:","en":"Low matching:","de":"Geringes Matching:","fr":"Faible appariement :","es":"Coincidencia baja:","it":"Basso matching:"},
 "bul_low_s": {
  "tr":"CBAM beyannamesinde Scope 2 emisyonunuz referans değerle hesaplanır → CBAM sertifikası maliyetiniz şişer.",
  "en":"In the CBAM declaration your Scope 2 emissions default to the EU reference value → your CBAM certificate cost balloons.",
  "de":"In der CBAM-Erklärung werden Ihre Scope-2-Emissionen mit dem EU-Referenzwert angesetzt → Ihre CBAM-Zertifikatskosten steigen stark.",
  "fr":"Dans la déclaration MACF, vos émissions Scope 2 sont calculées avec la valeur de référence UE → votre coût en certificats MACF explose.",
  "es":"En la declaración MAFC, sus emisiones de Alcance 2 se calculan con el valor de referencia UE → el coste en certificados MAFC se dispara.",
  "it":"Nella dichiarazione CBAM le tue emissioni Scope 2 sono calcolate sul valore di riferimento UE → il costo dei certificati CBAM aumenta drasticamente.",
 },
 "bul_high_t": {"tr":"Voltfox ile yüksek eşleşme:","en":"High matching with Voltfox:","de":"Hohes Matching mit Voltfox:","fr":"Appariement élevé avec Voltfox :","es":"Alta coincidencia con Voltfox:","it":"Alto matching con Voltfox:"},
 "bul_high_s": {
  "tr":"Saatlik bazda eşleşen tüketim sıfır emisyon kabul edilir → CBAM yükümlülüğünüz orantılı şekilde düşer.",
  "en":"Consumption matched on an hourly basis counts as zero emissions → your CBAM liability falls proportionally.",
  "de":"Stündlich gematchter Verbrauch zählt als emissionsfrei → Ihre CBAM-Pflicht sinkt proportional.",
  "fr":"La consommation appariée horaire compte comme émission nulle → votre obligation MACF baisse proportionnellement.",
  "es":"El consumo emparejado por hora se contabiliza como emisión cero → su obligación MAFC disminuye proporcionalmente.",
  "it":"Il consumo matchato su base oraria conta come emissione zero → il tuo obbligo CBAM scende in modo proporzionale.",
 },
 "s4": {"tr":"4 · CBAM finansal parametreleri","en":"4 · CBAM financial parameters","de":"4 · CBAM-Finanzparameter","fr":"4 · Paramètres financiers MACF","es":"4 · Parámetros financieros MAFC","it":"4 · Parametri finanziari CBAM"},
 "lbl_ets": {"tr":"AB ETS sertifika fiyatı (€ / tCO₂)","en":"EU ETS certificate price (€ / tCO₂)","de":"EU-ETS-Zertifikatspreis (€ / tCO₂)","fr":"Prix du certificat SEQE-UE (€ / tCO₂)","es":"Precio del certificado RCDE UE (€ / tCO₂)","it":"Prezzo certificato EU ETS (€ / tCO₂)"},
 "lbl_local": {"tr":"Menşe ülkede ödenen karbon fiyatı (€ / tCO₂)","en":"Carbon price paid in country of origin (€ / tCO₂)","de":"Im Ursprungsland gezahlter CO₂-Preis (€ / tCO₂)","fr":"Prix du carbone payé dans le pays d'origine (€ / tCO₂)","es":"Precio del carbono pagado en el país de origen (€ / tCO₂)","it":"Prezzo del carbonio pagato nel paese di origine (€ / tCO₂)"},
 "lbl_year": {"tr":"CBAM yükümlülük yılı","en":"CBAM compliance year","de":"CBAM-Verpflichtungsjahr","fr":"Année de conformité MACF","es":"Año de cumplimiento MAFC","it":"Anno di conformità CBAM"},
 "hint_year": {
  "tr":"AB CBAM Tüzüğü Madde 36(2)(d) uyarınca ücretsiz tahsis 2026–2034 arasında kademeli olarak %0'a iner. Yılı kaydırarak yükümlülüğünüzün geçiş döneminde nasıl ölçekleneceğini görün.",
  "en":"Under Article 36(2)(d) of the EU CBAM Regulation, free allocation phases out from 2026 to 2034 (reaching 0%). Slide the year to see how your liability scales during the transitional period.",
  "de":"Gemäß Artikel 36(2)(d) der EU-CBAM-Verordnung wird die kostenlose Zuteilung von 2026 bis 2034 auf 0% reduziert. Verschieben Sie den Jahresregler, um die Skalierung Ihrer Pflicht in der Übergangsphase zu sehen.",
  "fr":"Conformément à l'article 36(2)(d) du règlement MACF UE, l'allocation gratuite est progressivement supprimée de 2026 à 2034 (atteignant 0%). Déplacez l'année pour voir comment votre obligation évolue pendant la période transitoire.",
  "es":"Según el artículo 36(2)(d) del Reglamento MAFC UE, la asignación gratuita se elimina gradualmente entre 2026 y 2034 (hasta 0%). Deslice el año para ver cómo escala su obligación en el período transitorio.",
  "it":"Ai sensi dell'articolo 36(2)(d) del Regolamento CBAM UE, l'assegnazione gratuita viene eliminata progressivamente dal 2026 al 2034 (fino allo 0%). Sposta l'anno per vedere come l'obbligo scala nel periodo transitorio.",
 },
 "meth_sum": {"tr":"Hesaplama metodolojisi","en":"Calculation methodology","de":"Berechnungsmethodik","fr":"Méthodologie de calcul","es":"Metodología de cálculo","it":"Metodologia di calcolo"},
 "card2_title": {"tr":"Sonuçlar","en":"Results","de":"Ergebnisse","fr":"Résultats","es":"Resultados","it":"Risultati"},
 "prod_empty": {"tr":"Bir ürün seçin.","en":"Select a product.","de":"Wählen Sie ein Produkt.","fr":"Sélectionnez un produit.","es":"Seleccione un producto.","it":"Seleziona un prodotto."},
 "viz_ef_title": {"tr":"Birim ürün başına gömülü emisyon faktörleri","en":"Embedded emission factors per unit of product","de":"Eingebettete Emissionsfaktoren je Produkteinheit","fr":"Facteurs d'émissions intégrées par unité de produit","es":"Factores de emisión incorporada por unidad de producto","it":"Fattori di emissione incorporata per unità di prodotto"},
 "ef_dir": {"tr":"Referans · doğrudan","en":"Default · direct","de":"Standard · direkt","fr":"Par défaut · direct","es":"Predeterminado · directo","it":"Predefinito · diretto"},
 "ef_ind": {"tr":"Referans · dolaylı (Scope 2)","en":"Default · indirect (Scope 2)","de":"Standard · indirekt (Scope 2)","fr":"Par défaut · indirect (Scope 2)","es":"Predeterminado · indirecto (Alcance 2)","it":"Predefinito · indiretto (Scope 2)"},
 "ef_act": {"tr":"Gerçekleşen Scope 2","en":"Actual Scope 2 (after matching)","de":"Tatsächlicher Scope 2 (nach Matching)","fr":"Scope 2 réel (après appariement)","es":"Alcance 2 real (tras coincidencia)","it":"Scope 2 reale (post-matching)"},
 "ef_tot": {"tr":"Toplam (gerçek veriyle)","en":"Total (with your data)","de":"Gesamt (mit Ihren Daten)","fr":"Total (avec vos données)","es":"Total (con sus datos)","it":"Totale (con i tuoi dati)"},
 "big_label": {"tr":"Yıllık CBAM yükümlülüğü","en":"Annual CBAM liability","de":"Jährliche CBAM-Pflicht","fr":"Obligation MACF annuelle","es":"Obligación MAFC anual","it":"Obbligo CBAM annuo"},
 "big_sub": {"tr":"(referans değerle)","en":"(at default values)","de":"(zu Standardwerten)","fr":"(aux valeurs par défaut)","es":"(con valores predeterminados)","it":"(ai valori predefiniti)"},
 "saving_label": {"tr":"Voltfox ile potansiyel yıllık tasarruf","en":"Potential annual savings with Voltfox","de":"Potenzielle jährliche Einsparungen mit Voltfox","fr":"Économies annuelles potentielles avec Voltfox","es":"Ahorro anual potencial con Voltfox","it":"Risparmio annuo potenziale con Voltfox"},
 "saving_legend": {"tr":"Referans dolaylı → gerçekleşen dolaylı","en":"Default indirect → actual indirect","de":"Standard indirekt → tatsächlich indirekt","fr":"Indirect par défaut → indirect réel","es":"Indirecto predeterminado → indirecto real","it":"Indiretto predefinito → indiretto reale"},
 "cbam_actual_label": {"tr":"Yıllık CBAM (gerçek veriyle)","en":"Annual CBAM (with your data)","de":"Jährliches CBAM (mit Ihren Daten)","fr":"MACF annuel (avec vos données)","es":"MAFC anual (con sus datos)","it":"CBAM annuo (con i tuoi dati)"},
 "risk_label": {"tr":"CBAM risk seviyesi","en":"CBAM risk level","de":"CBAM-Risikostufe","fr":"Niveau de risque MACF","es":"Nivel de riesgo MAFC","it":"Livello di rischio CBAM"},
 "risk_low": {"tr":"Düşük","en":"Low","de":"Gering","fr":"Faible","es":"Bajo","it":"Basso"},
 "risk_med": {"tr":"Orta","en":"Moderate","de":"Mittel","fr":"Modéré","es":"Moderado","it":"Moderato"},
 "risk_high": {"tr":"Yüksek","en":"High","de":"Hoch","fr":"Élevé","es":"Alto","it":"Alto"},
 "trend_title": {"tr":"2026 → 2034 CBAM yükümlülüğünün kademeli geçişi","en":"2026 → 2034 CBAM phase-in trajectory","de":"2026 → 2034 CBAM-Einführungsverlauf","fr":"Trajectoire de mise en place du MACF 2026 → 2034","es":"Trayectoria de implantación MAFC 2026 → 2034","it":"Traiettoria di entrata in vigore CBAM 2026 → 2034"},
 "lg_dv": {"tr":"Referans değerle","en":"At default values","de":"Mit Standardwerten","fr":"Aux valeurs par défaut","es":"Con valores predeterminados","it":"Ai valori predefiniti"},
 "lg_actual": {"tr":"Gerçek veriyle","en":"With your data","de":"Mit Ihren Daten","fr":"Avec vos données","es":"Con sus datos","it":"Con i tuoi dati"},
 "lg_current": {"tr":"Seçili yıl","en":"Selected year","de":"Ausgewähltes Jahr","fr":"Année sélectionnée","es":"Año seleccionado","it":"Anno selezionato"},
 "cta_lead": {"tr":"Detaylı analiz için demo talep edin →","en":"Request a demo for detailed analysis →","de":"Demo für detaillierte Analyse anfordern →","fr":"Demander une démo pour une analyse détaillée →","es":"Solicitar demo para análisis detallado →","it":"Richiedi una demo per un'analisi dettagliata →"},
 "cta_explore": {"tr":"Voltfox GreenLink platformunu inceleyin","en":"Explore the Voltfox GreenLink platform","de":"Voltfox-GreenLink-Plattform entdecken","fr":"Découvrir la plateforme Voltfox GreenLink","es":"Conozca la plataforma Voltfox GreenLink","it":"Scopri la piattaforma Voltfox GreenLink"},
 "f_name": {"tr":"Ad Soyad","en":"Full name","de":"Vor- und Nachname","fr":"Nom complet","es":"Nombre completo","it":"Nome e cognome"},
 "f_co": {"tr":"Şirket","en":"Company","de":"Unternehmen","fr":"Société","es":"Empresa","it":"Azienda"},
 "f_email": {"tr":"Kurumsal e-posta","en":"Business email","de":"Geschäftliche E-Mail","fr":"E-mail professionnel","es":"Correo corporativo","it":"Email aziendale"},
 "f_phone": {"tr":"Telefon (opsiyonel)","en":"Phone (optional)","de":"Telefon (optional)","fr":"Téléphone (facultatif)","es":"Teléfono (opcional)","it":"Telefono (opzionale)"},
 "f_submit": {"tr":"CBAM raporumu gönderin","en":"Send my CBAM report","de":"CBAM-Bericht senden","fr":"Envoyer mon rapport MACF","es":"Enviar mi informe MAFC","it":"Inviami il report CBAM"},
 "f_ok": {
  "tr":"Talebiniz alındı. Voltfox ekibi 1 iş günü içinde kişiselleştirilmiş CBAM raporunuzla iletişime geçecek.",
  "en":"Request received. The Voltfox team will reach out within 1 business day with your personalised CBAM report.",
  "de":"Anfrage erhalten. Das Voltfox-Team meldet sich innerhalb von 1 Werktag mit Ihrem personalisierten CBAM-Bericht.",
  "fr":"Demande reçue. L'équipe Voltfox vous contactera sous 1 jour ouvré avec votre rapport MACF personnalisé.",
  "es":"Solicitud recibida. El equipo de Voltfox se pondrá en contacto en 1 día laborable con su informe MAFC personalizado.",
  "it":"Richiesta ricevuta. Il team Voltfox ti contatterà entro 1 giorno lavorativo con il tuo report CBAM personalizzato.",
 },
 "info_text": {
  "tr":"Voltfox GreenLink, CBAM beyanlarında raporlanan Scope 2 dolaylı emisyonları saat ve lokasyon bazında gerçek üretim/tüketim verisiyle hesaplar. Referans değer yerine bağımsız doğrulamalı, denetim hazır bir değer kullanmanızı sağlar — CBAM yükümlülüğünüz tipik olarak %20–35 oranında azalır.",
  "en":"Voltfox GreenLink computes the Scope 2 indirect emissions reported in your CBAM declaration on an hour-by-hour, location-by-location basis using real generation and consumption data. This replaces the default value with an independently verified, audit-ready figure — typically lowering your CBAM liability by 20–35%.",
  "de":"Voltfox GreenLink berechnet die in Ihrer CBAM-Erklärung gemeldeten indirekten Scope-2-Emissionen stunden- und standortgenau auf Basis realer Erzeugungs- und Verbrauchsdaten. So ersetzen Sie den Standardwert durch einen unabhängig verifizierten, prüfsicheren Wert — typischerweise sinkt Ihre CBAM-Pflicht um 20–35%.",
  "fr":"Voltfox GreenLink calcule les émissions indirectes Scope 2 déclarées dans votre déclaration MACF heure par heure et site par site à partir de données réelles de production/consommation. Remplacez la valeur par défaut par une donnée vérifiée indépendamment et prête pour audit — votre obligation MACF baisse typiquement de 20 à 35%.",
  "es":"Voltfox GreenLink calcula las emisiones indirectas de Alcance 2 declaradas en su MAFC hora a hora y ubicación por ubicación con datos reales de generación y consumo. Sustituye el valor predeterminado por una cifra verificada independientemente y lista para auditoría — su obligación MAFC suele reducirse entre un 20 % y un 35 %.",
  "it":"Voltfox GreenLink calcola le emissioni indirette Scope 2 riportate nella tua dichiarazione CBAM ora per ora e sito per sito con dati reali di produzione/consumo. Sostituisci il valore predefinito con un dato verificato in modo indipendente e pronto per audit — il tuo obbligo CBAM tipicamente cala del 20–35%.",
 },
 "footer": {
  "tr":"© Voltfox · voltfox.io · Veri kaynağı: AB Komisyonu CBAM Referans Değerleri (v2026-02-04)",
  "en":"© Voltfox · voltfox.io · Data source: European Commission CBAM Default Values (v2026-02-04)",
  "de":"© Voltfox · voltfox.io · Datenquelle: CBAM-Standardwerte der EU-Kommission (v2026-02-04)",
  "fr":"© Voltfox · voltfox.io · Source : Valeurs par défaut MACF de la Commission européenne (v2026-02-04)",
  "es":"© Voltfox · voltfox.io · Fuente: Valores predeterminados MAFC de la Comisión Europea (v2026-02-04)",
  "it":"© Voltfox · voltfox.io · Fonte: Valori predefiniti CBAM della Commissione europea (v2026-02-04)",
 },
 "b_qsi": {"tr":"QSI Doğrulamalı","en":"QSI Verified","de":"QSI-zertifiziert","fr":"Vérifié QSI","es":"Verificado por QSI","it":"Verificato QSI"},
 "free_alloc_pill": {
  "tr":"{y} · ücretsiz tahsis %{fa}",
  "en":"{y} · free allocation {fa}%",
  "de":"{y} · kostenlose Zuteilung {fa}%",
  "fr":"{y} · allocation gratuite {fa}%",
  "es":"{y} · asignación gratuita {fa}%",
  "it":"{y} · assegnazione gratuita {fa}%",
 },
 "src_fallback": {
  "tr":"veri kaynağı: {c} (fallback)",
  "en":"data source: {c} (fallback)",
  "de":"Datenquelle: {c} (Fallback)",
  "fr":"source : {c} (repli)",
  "es":"fuente: {c} (alternativa)",
  "it":"fonte: {c} (fallback)",
 },
}

# Build the I18N JS injection
js = (
 "  // i18n\n"
 "  const I18N = " + json.dumps(I18N, ensure_ascii=False) + ";\n"
 "  const LANGS = " + json.dumps(LANGS) + ";\n"
 "  const LANG_NAMES = " + json.dumps(LANG_NAMES, ensure_ascii=False) + ";\n"
 "  let CURRENT_LANG = 'tr';\n"
 "  function t(key, vars){\n"
 "    const entry = I18N[key];\n"
 "    if(!entry) return key;\n"
 "    let s = entry[CURRENT_LANG] || entry['en'] || entry['tr'] || '';\n"
 "    if(vars){ Object.keys(vars).forEach(k => { s = s.replace('{'+k+'}', vars[k]); }); }\n"
 "    return s;\n"
 "  }\n"
 "  function applyLang(lang){\n"
 "    if(!LANGS.includes(lang)) lang = 'tr';\n"
 "    CURRENT_LANG = lang;\n"
 "    document.documentElement.lang = lang;\n"
 "    document.querySelectorAll('[data-i18n]').forEach(el => {\n"
 "      const k = el.getAttribute('data-i18n');\n"
 "      const tr = t(k);\n"
 "      if(el.tagName === 'TITLE') document.title = tr;\n"
 "      else el.textContent = tr;\n"
 "    });\n"
 "    // re-render dynamic strings\n"
 "    if(typeof applyYear === 'function') applyYear();\n"
 "    if(typeof calc === 'function') calc();\n"
 "    try{ localStorage.setItem('voltfox_lang', lang); }catch(e){}\n"
 "  }\n"
 "  function detectLang(){\n"
 "    try{ const saved = localStorage.getItem('voltfox_lang'); if(saved && LANGS.includes(saved)) return saved; }catch(e){}\n"
 "    const navLangs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'tr'];\n"
 "    for(const l of navLangs){ const base = (l||'').toLowerCase().split('-')[0]; if(LANGS.includes(base)) return base; }\n"
 "    return 'tr';\n"
 "  }\n"
 "  (function initLangSelector(){\n"
 "    const sel = document.getElementById('langSel'); if(!sel) return;\n"
 "    LANGS.forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = LANG_NAMES[l]; sel.appendChild(o); });\n"
 "    const initial = detectLang();\n"
 "    sel.value = initial;\n"
 "    sel.addEventListener('change', e => applyLang(e.target.value));\n"
 "    applyLang(initial);\n"
 "  })();\n"
)

# Inject the i18n block right after `const COUNTRIES = DATA.countries;`
marker = 'const COUNTRIES = DATA.countries;'
h = h.replace(marker, marker + '\n' + js, 1)

# Update calc() to use translated risk levels and pill — patch direct strings
h = h.replace('risk = "Düşük"', 'risk = t("risk_low")')
h = h.replace('risk = "Yüksek"', 'risk = t("risk_high")')
h = h.replace('risk = "Orta"', 'risk = t("risk_med")')
h = h.replace('$("freeAllocPill").textContent = `${y} · ücretsiz tahsis %${fa.toString().replace(\'.\',\',\')}`;',
              '$("freeAllocPill").textContent = t("free_alloc_pill", { y: y, fa: fa.toString().replace(".",",") });')
h = h.replace('source = bestCountry + " (fallback)";',
              'source = t("src_fallback", { c: bestCountry });')

# Empty product summary uses textContent assignment — patch it
h = h.replace('$("prodSummary").textContent = "Bir ürün seçin.";',
              '$("prodSummary").textContent = t("prod_empty");')

open(p,'w',encoding='utf-8').write(h)
print('OK size:', len(h))
