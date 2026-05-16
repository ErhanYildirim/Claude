
  const WEBHOOK_URL = ""; // Buraya CRM webhook URL'sini girin
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat("tr-TR",{maximumFractionDigits:0}).format(Math.round(n));
  const fmt2 = n => (n==null||isNaN(n))?'—':new Intl.NumberFormat("tr-TR",{maximumFractionDigits:3}).format(n);
  const fmtEUR = n => "€" + fmt(n);

  const DATA = window.CBAM_DATA;
  const CN = DATA.cn;
  const COUNTRIES = DATA.countries;
  // i18n
  const I18N = {"page_title": {"tr": "CBAM Risk Hesaplayıcı | Voltfox", "en": "CBAM Risk Calculator | Voltfox", "de": "CBAM-Risikorechner | Voltfox", "fr": "Calculateur de risque MACF | Voltfox", "es": "Calculadora de riesgo MAFC | Voltfox", "it": "Calcolatore di rischio CBAM | Voltfox"}, "header_tag": {"tr": "CBAM Risk Hesaplayıcı · Referans Değerler v2026-02-04", "en": "CBAM Risk Calculator · Default Values v2026-02-04", "de": "CBAM-Risikorechner · Standardwerte v2026-02-04", "fr": "Calculateur de risque MACF · Valeurs par défaut v2026-02-04", "es": "Calculadora de riesgo MAFC · Valores predeterminados v2026-02-04", "it": "Calcolatore di rischio CBAM · Valori predefiniti v2026-02-04"}, "h1_a": {"tr": "AB Komisyonu", "en": "European Commission", "de": "EU-Kommission", "fr": "Commission européenne", "es": "Comisión Europea", "it": "Commissione europea"}, "h1_b": {"tr": "resmi referans değerleri", "en": "official default values", "de": "offizielle Standardwerte", "fr": "valeurs par défaut officielles", "es": "valores predeterminados oficiales", "it": "valori predefiniti ufficiali"}, "h1_c": {"tr": "ile gerçek CBAM riskinizi hesaplayın", "en": "— calculate your real CBAM exposure", "de": "— berechnen Sie Ihr tatsächliches CBAM-Risiko", "fr": "— calculez votre exposition MACF réelle", "es": "— calcule su exposición MAFC real", "it": "— calcola la tua reale esposizione CBAM"}, "lede": {"tr": "Menşe ülke ve KN (CN) kodu seçin; saatlik Scope 2 muhasebesi ve 24/7 yenilenebilir enerji eşleştirme oranınız ile ürün başına gömülü emisyon faktörünüzü, yıllık CBAM yükümlülüğünüzü ve Voltfox 24/7 CFE platformuyla elde edebileceğiniz tasarrufu hesaplayın. Referans (default) değerler AB Komisyonu'nun 4 Şubat 2026 tarihli Uygulama Tüzüğü Ek IV tablosundan alınmıştır.", "en": "Select country of origin and CN code; calculate your embedded emission factor per unit, annual CBAM liability and savings via Voltfox's 24/7 CFE platform — using hourly Scope 2 accounting and your 24/7 renewable matching rate. Default values are sourced from Annex IV of the European Commission's CBAM Implementing Regulation (published 4 Feb 2026).", "de": "Wählen Sie Ursprungsland und KN-Code; ermitteln Sie Ihren produktspezifischen eingebetteten Emissionsfaktor, die jährliche CBAM-Pflicht und Ihre Einsparungen mit der 24/7-CFE-Plattform von Voltfox — auf Basis stündlicher Scope-2-Bilanzierung und Ihrer 24/7-Erneuerbaren-Matching-Rate. Standardwerte stammen aus Anhang IV der CBAM-Durchführungsverordnung (veröffentlicht am 4. Februar 2026).", "fr": "Sélectionnez le pays d'origine et le code NC ; calculez votre facteur d'émission intégré par unité, votre obligation MACF annuelle et vos économies via la plateforme 24/7 CFE de Voltfox — sur la base d'une comptabilité Scope 2 horaire et de votre taux d'appariement renouvelable 24/7. Les valeurs par défaut proviennent de l'annexe IV du règlement d'exécution MACF de la Commission européenne (publié le 4 février 2026).", "es": "Seleccione país de origen y código NC; calcule su factor de emisión incorporada por unidad, la obligación MAFC anual y los ahorros con la plataforma 24/7 CFE de Voltfox — usando contabilidad Scope 2 horaria y su tasa de coincidencia renovable 24/7. Los valores predeterminados provienen del Anexo IV del Reglamento de Ejecución MAFC de la Comisión Europea (publicado el 4 de febrero de 2026).", "it": "Seleziona il paese di origine e il codice NC; calcola il tuo fattore di emissione incorporata per unità, l'obbligo CBAM annuo e i risparmi con la piattaforma 24/7 CFE di Voltfox — usando contabilità Scope 2 oraria e il tuo tasso di matching rinnovabile 24/7. I valori predefiniti provengono dall'Allegato IV del Regolamento di esecuzione CBAM della Commissione europea (pubblicato il 4 febbraio 2026)."}, "card1_title": {"tr": "Ürün, menşe ve operasyonel parametreler", "en": "Product, origin and operational parameters", "de": "Produkt-, Ursprungs- und Betriebsparameter", "fr": "Produit, origine et paramètres opérationnels", "es": "Producto, origen y parámetros operativos", "it": "Prodotto, origine e parametri operativi"}, "card1_sub": {"tr": "Tüm hesaplama tarayıcınızda gerçekleşir; veriler hiçbir sunucuya iletilmez.", "en": "All calculations run locally in your browser; no data is sent to any server.", "de": "Alle Berechnungen erfolgen lokal in Ihrem Browser; keine Daten werden an Server gesendet.", "fr": "Tous les calculs s'exécutent localement dans votre navigateur ; aucune donnée n'est transmise à un serveur.", "es": "Todos los cálculos se realizan localmente en su navegador; no se envían datos a ningún servidor.", "it": "Tutti i calcoli vengono eseguiti localmente nel browser; nessun dato viene inviato ai server."}, "s1": {"tr": "1 · Ürün ve menşe ülke", "en": "1 · Product and country of origin", "de": "1 · Produkt und Ursprungsland", "fr": "1 · Produit et pays d'origine", "es": "1 · Producto y país de origen", "it": "1 · Prodotto e paese di origine"}, "lbl_country": {"tr": "Menşe ülke", "en": "Country of origin", "de": "Ursprungsland", "fr": "Pays d'origine", "es": "País de origen", "it": "Paese di origine"}, "lbl_category": {"tr": "CBAM sektörü (filtre)", "en": "CBAM sector (filter)", "de": "CBAM-Sektor (Filter)", "fr": "Secteur MACF (filtre)", "es": "Sector MAFC (filtro)", "it": "Settore CBAM (filtro)"}, "opt_all": {"tr": "Tüm sektörler", "en": "All sectors", "de": "Alle Sektoren", "fr": "Tous les secteurs", "es": "Todos los sectores", "it": "Tutti i settori"}, "lbl_product": {"tr": "KN (CN) kodu / ürün", "en": "CN code / product", "de": "KN-Code / Produkt", "fr": "Code NC / produit", "es": "Código NC / producto", "it": "Codice NC / prodotto"}, "hint_product": {"tr": "Seçilen ülke için AB CBAM Uygulama Tüzüğü'ndeki resmi referans değerler kullanılır.", "en": "Official default values from the EU CBAM Implementing Regulation are applied for the selected country.", "de": "Es werden die offiziellen Standardwerte der CBAM-Durchführungsverordnung für das gewählte Land angewendet.", "fr": "Les valeurs par défaut officielles du règlement d'exécution MACF sont appliquées pour le pays sélectionné.", "es": "Se aplican los valores predeterminados oficiales del Reglamento de Ejecución MAFC para el país seleccionado.", "it": "Per il paese selezionato vengono applicati i valori predefiniti ufficiali del Regolamento di esecuzione CBAM."}, "s2": {"tr": "2 · AB ithalat hacmi", "en": "2 · EU import volume", "de": "2 · EU-Importvolumen", "fr": "2 · Volume d'importation UE", "es": "2 · Volumen de importación a la UE", "it": "2 · Volume di importazione UE"}, "lbl_volume": {"tr": "AB'ye yıllık ihracat hacmi (ton / MWh)", "en": "Annual export volume to the EU (tonnes / MWh)", "de": "Jährliches Exportvolumen in die EU (Tonnen / MWh)", "fr": "Volume annuel d'exportation vers l'UE (tonnes / MWh)", "es": "Volumen anual de exportación a la UE (toneladas / MWh)", "it": "Volume annuo di esportazione verso l'UE (tonnellate / MWh)"}, "lbl_period": {"tr": "Referans değer mark-up dönemi", "en": "Default value mark-up period", "de": "Standardwert-Aufschlagsperiode", "fr": "Période de majoration de la valeur par défaut", "es": "Período de recargo del valor predeterminado", "it": "Periodo di mark-up del valore predefinito"}, "opt_v2026": {"tr": "2026 (+%10 mark-up)", "en": "2026 (+10% mark-up)", "de": "2026 (+10% Aufschlag)", "fr": "2026 (+10% majoration)", "es": "2026 (+10% recargo)", "it": "2026 (+10% mark-up)"}, "opt_v2027": {"tr": "2027 (+%20 mark-up)", "en": "2027 (+20% mark-up)", "de": "2027 (+20% Aufschlag)", "fr": "2027 (+20% majoration)", "es": "2027 (+20% recargo)", "it": "2027 (+20% mark-up)"}, "opt_v2028": {"tr": "2028 ve sonrası (+%30 mark-up)", "en": "2028 and beyond (+30% mark-up)", "de": "2028 und später (+30% Aufschlag)", "fr": "2028 et au-delà (+30% majoration)", "es": "2028 en adelante (+30% recargo)", "it": "2028 e oltre (+30% mark-up)"}, "no_data": {"tr": "Seçilen menşe ülke için bu KN kodunda yayımlanmış resmi referans değer bulunmuyor. Doğrulanmış veri sağlanmadığı sürece AB Komisyonu, başka bir kaynak ülkenin değerini veya AB iç pazarındaki en yüksek değeri uygular. Aşağıda kullanılan değer fallback olarak gösteriliyor.", "en": "No official default value has been published for this CN code under the selected country of origin. Unless verified data is provided, the EU Commission applies the value of another source country or the highest EU domestic value. The value shown below is used as a fallback.", "de": "Für diesen KN-Code unter dem gewählten Ursprungsland wurde kein offizieller Standardwert veröffentlicht. Solange keine verifizierten Daten vorliegen, wendet die EU-Kommission den Wert eines anderen Ursprungslandes oder den höchsten EU-Binnenwert an. Der unten angezeigte Wert dient als Fallback.", "fr": "Aucune valeur par défaut officielle n'a été publiée pour ce code NC pour le pays d'origine sélectionné. Sans données vérifiées, la Commission européenne applique la valeur d'un autre pays source ou la valeur intérieure UE la plus élevée. La valeur ci-dessous est utilisée comme valeur de repli.", "es": "No se ha publicado un valor predeterminado oficial para este código NC en el país de origen seleccionado. Sin datos verificados, la Comisión Europea aplica el valor de otro país de origen o el valor interno más alto de la UE. El valor que aparece a continuación se utiliza como alternativa.", "it": "Per questo codice NC nel paese di origine selezionato non è stato pubblicato un valore predefinito ufficiale. In assenza di dati verificati, la Commissione UE applica il valore di un altro paese di origine o il valore interno UE più alto. Il valore mostrato di seguito è utilizzato come fallback."}, "s3": {"tr": "3 · Scope 2 (elektrik) — gömülü dolaylı emisyonlar", "en": "3 · Scope 2 (electricity) — embedded indirect emissions", "de": "3 · Scope 2 (Strom) — eingebettete indirekte Emissionen", "fr": "3 · Scope 2 (électricité) — émissions indirectes intégrées", "es": "3 · Alcance 2 (electricidad) — emisiones indirectas incorporadas", "it": "3 · Scope 2 (elettricità) — emissioni indirette incorporate"}, "s3_lead_a": {"tr": "Bu KN kodu için AB referans tablosunda gömülü dolaylı emisyon", "en": "For this CN code, the EU default table reports embedded indirect emissions of", "de": "Für diesen KN-Code weist die EU-Standardtabelle eingebettete indirekte Emissionen von", "fr": "Pour ce code NC, la table de référence UE indique des émissions indirectes intégrées de", "es": "Para este código NC, la tabla de referencia UE indica emisiones indirectas incorporadas de", "it": "Per questo codice NC, la tabella di riferimento UE indica emissioni indirette incorporate di"}, "s3_lead_b": {"tr": "tCO₂ / ürün olarak yayımlanmış. Yenilenebilir enerji eşleştirmeniz bu değeri eşleşen oranda sıfıra indirir.", "en": "tCO₂ per unit. Your renewable energy matching reduces this value to zero proportionally to the match rate.", "de": "tCO₂ pro Einheit aus. Ihr Erneuerbaren-Matching reduziert diesen Wert anteilig zur Match-Quote auf null.", "fr": "tCO₂ par unité. Votre appariement avec les énergies renouvelables réduit cette valeur à zéro proportionnellement au taux d'appariement.", "es": "tCO₂ por unidad. Su emparejamiento con energía renovable reduce este valor a cero en proporción a la tasa de coincidencia.", "it": "tCO₂ per unità. Il tuo matching con energia rinnovabile riduce questo valore a zero in proporzione al tasso di matching."}, "lbl_elec": {"tr": "Birim ürün başına elektrik tüketimi (MWh / ürün)", "en": "Electricity consumption per unit of product (MWh / unit)", "de": "Stromverbrauch pro Produkteinheit (MWh / Einheit)", "fr": "Consommation électrique par unité de produit (MWh / unité)", "es": "Consumo eléctrico por unidad de producto (MWh / unidad)", "it": "Consumo elettrico per unità di prodotto (MWh / unità)"}, "hint_elec": {"tr": "KN kodu seçildiğinde tipik sektörel değer otomatik doldurulur; gerçek değerinizi girebilirsiniz.", "en": "A typical sector-specific value is auto-filled when a CN code is selected; you can override it with your real value.", "de": "Bei Auswahl eines KN-Codes wird ein sektortypischer Wert automatisch eingetragen; Sie können ihn mit Ihrem realen Wert überschreiben.", "fr": "Une valeur typique du secteur est pré-remplie à la sélection d'un code NC ; vous pouvez la remplacer par votre valeur réelle.", "es": "Al seleccionar un código NC se rellena automáticamente un valor sectorial típico; puede sobrescribirlo con su valor real.", "it": "Selezionando un codice NC viene precompilato un valore tipico del settore; puoi sostituirlo con il tuo valore reale."}, "lbl_grid": {"tr": "Şebeke emisyon faktörü (tCO₂ / MWh)", "en": "Grid emission factor (tCO₂ / MWh)", "de": "Netz-Emissionsfaktor (tCO₂ / MWh)", "fr": "Facteur d'émission du réseau (tCO₂ / MWh)", "es": "Factor de emisión de la red (tCO₂ / MWh)", "it": "Fattore di emissione di rete (tCO₂ / MWh)"}, "hint_grid": {"tr": "Türkiye 2024: ~0,42 · AB ortalaması: ~0,23 tCO₂/MWh.", "en": "Türkiye 2024: ~0.42 · EU average: ~0.23 tCO₂/MWh.", "de": "Türkei 2024: ~0,42 · EU-Durchschnitt: ~0,23 tCO₂/MWh.", "fr": "Türkiye 2024 : ~0,42 · Moyenne UE : ~0,23 tCO₂/MWh.", "es": "Türkiye 2024: ~0,42 · Media UE: ~0,23 tCO₂/MWh.", "it": "Türkiye 2024: ~0,42 · Media UE: ~0,23 tCO₂/MWh."}, "lbl_renew": {"tr": "Yıllık yenilenebilir enerji hacminiz (MWh) — kendi üretim, PPA veya I-REC", "en": "Your annual renewable energy volume (MWh) — own generation, PPA or I-REC", "de": "Ihre jährliche Erneuerbaren-Menge (MWh) — Eigenerzeugung, PPA oder I-REC", "fr": "Votre volume annuel d'énergie renouvelable (MWh) — production propre, PPA ou I-REC", "es": "Su volumen anual de energía renovable (MWh) — generación propia, PPA o I-REC", "it": "Volume annuo di energia rinnovabile (MWh) — autoproduzione, PPA o I-REC"}, "hint_renew": {"tr": "Sahip olduğunuz veya uzun vadeli PPA / I-REC / EKS sertifikasıyla sözleşmeli yenilenebilir enerji hacmi.", "en": "Renewable energy you own or contract via long-term PPA / I-REC / EAC certificates.", "de": "Erneuerbare Energie, die Sie besitzen oder über langfristige PPAs / I-RECs / EACs vertraglich beziehen.", "fr": "Énergie renouvelable que vous possédez ou contractez via des PPA / I-REC / AEC à long terme.", "es": "Energía renovable propia o contratada mediante PPA / I-REC / EAC a largo plazo.", "it": "Energia rinnovabile di proprietà o contrattualizzata tramite PPA / I-REC / EAC a lungo termine."}, "match_badge": {"tr": "⚡ EŞLEŞTİRME METODOLOJİSİ", "en": "⚡ MATCHING METHODOLOGY", "de": "⚡ MATCHING-METHODE", "fr": "⚡ MÉTHODE D'APPARIEMENT", "es": "⚡ METODOLOGÍA DE COINCIDENCIA", "it": "⚡ METODOLOGIA DI MATCHING"}, "match_tag": {"tr": "CBAM Scope 2 yükümlülüğünüzü belirleyen kritik faktör", "en": "The critical factor that determines your CBAM Scope 2 liability", "de": "Der entscheidende Faktor für Ihre CBAM-Scope-2-Pflicht", "fr": "Le facteur critique qui détermine votre obligation MACF Scope 2", "es": "El factor crítico que determina su obligación MAFC de Alcance 2", "it": "Il fattore critico che determina il tuo obbligo CBAM Scope 2"}, "match_lead_a": {"tr": "AB Komisyonu 2027'den itibaren", "en": "Starting in 2027, the European Commission is phasing in", "de": "Ab 2027 führt die EU-Kommission", "fr": "À partir de 2027, la Commission européenne met en œuvre", "es": "A partir de 2027, la Comisión Europea implementará", "it": "Dal 2027 la Commissione europea introduce progressivamente"}, "match_lead_b": {"tr": "saatlik (24/7) eşleştirme", "en": "hourly 24/7 matching", "de": "stündliches 24/7-Matching", "fr": "l'appariement horaire 24/7", "es": "el emparejamiento horario 24/7", "it": "il matching orario 24/7"}, "match_lead_c": {"tr": "zorunluluğunu kademeli olarak yürürlüğe koyuyor. Yıllık ortalama yenilenebilir sertifikalar artık CBAM beyanlarında savunulabilir kanıt olarak kabul edilmiyor.", "en": "as a requirement. Annual-average renewable certificates are no longer accepted as defensible evidence in CBAM declarations.", "de": "als Anforderung ein. Jährliche Durchschnitts-Zertifikate werden in CBAM-Erklärungen nicht mehr als belastbarer Nachweis akzeptiert.", "fr": "comme exigence. Les certificats renouvelables en moyenne annuelle ne sont plus acceptés comme preuve défendable dans les déclarations MACF.", "es": "como requisito. Los certificados de renovables en promedio anual ya no se aceptan como prueba defendible en las declaraciones MAFC.", "it": "come requisito. I certificati rinnovabili a media annuale non sono più accettati come prova difendibile nelle dichiarazioni CBAM."}, "opt_annual_t": {"tr": "Yıllık ortalama eşleştirme", "en": "Annual-average matching", "de": "Jährliches Durchschnitts-Matching", "fr": "Appariement en moyenne annuelle", "es": "Coincidencia por promedio anual", "it": "Matching a media annuale"}, "opt_annual_s": {"tr": "Klasik EKS / I-REC · Greenwashing riski yüksek", "en": "Classic EAC / I-REC · High greenwashing risk", "de": "Klassische EAC / I-REC · Hohes Greenwashing-Risiko", "fr": "AEC / I-REC classiques · Risque de greenwashing élevé", "es": "EAC / I-REC clásicos · Alto riesgo de greenwashing", "it": "EAC / I-REC classici · Alto rischio di greenwashing"}, "opt_annual_p": {"tr": "Eski yöntem", "en": "Legacy", "de": "Veraltet", "fr": "Obsolète", "es": "Heredado", "it": "Obsoleto"}, "opt_hourly_t": {"tr": "Saatlik 24/7 karbonsuz enerji (CFE)", "en": "Hourly 24/7 carbon-free energy (CFE)", "de": "Stündliche 24/7 kohlenstofffreie Energie (CFE)", "fr": "Énergie sans carbone horaire 24/7 (CFE)", "es": "Energía libre de carbono 24/7 horaria (CFE)", "it": "Energia carbon-free oraria 24/7 (CFE)"}, "opt_hourly_s": {"tr": "Voltfox metodolojisi · Saat ve lokasyon bazında doğrulanmış kanıt", "en": "Voltfox methodology · Hour-and-location-verified evidence", "de": "Voltfox-Methodik · Stunden- und standortverifizierter Nachweis", "fr": "Méthodologie Voltfox · Preuve vérifiée par heure et lieu", "es": "Metodología Voltfox · Evidencia verificada por hora y ubicación", "it": "Metodologia Voltfox · Prova verificata per ora e luogo"}, "opt_hourly_p": {"tr": "Önerilen", "en": "Recommended", "de": "Empfohlen", "fr": "Recommandé", "es": "Recomendado", "it": "Consigliato"}, "meter_head": {"tr": "Eşleştirme oranınız", "en": "Your matching rate", "de": "Ihre Matching-Quote", "fr": "Votre taux d'appariement", "es": "Su tasa de coincidencia", "it": "Il tuo tasso di matching"}, "scale_0": {"tr": "%0 · Tamamı şebeke karışımı", "en": "0% · Full grid mix", "de": "0% · Vollständiger Netzmix", "fr": "0% · Mix réseau complet", "es": "0% · Mezcla de red completa", "it": "0% · Mix di rete completo"}, "scale_85": {"tr": "%85+ · Voltfox müşteri ortalaması", "en": "85%+ · Voltfox customer average", "de": "85%+ · Voltfox-Kundendurchschnitt", "fr": "85%+ · Moyenne client Voltfox", "es": "85%+ · Promedio de clientes Voltfox", "it": "85%+ · Media clienti Voltfox"}, "scale_100": {"tr": "%100 · 24/7 tam karbonsuz", "en": "100% · 24/7 fully carbon-free", "de": "100% · 24/7 vollständig kohlenstofffrei", "fr": "100% · 24/7 entièrement sans carbone", "es": "100% · 24/7 totalmente libre de carbono", "it": "100% · 24/7 totalmente carbon-free"}, "bul_low_t": {"tr": "Düşük eşleşme:", "en": "Low matching:", "de": "Geringes Matching:", "fr": "Faible appariement :", "es": "Coincidencia baja:", "it": "Basso matching:"}, "bul_low_s": {"tr": "CBAM beyannamesinde Scope 2 emisyonunuz referans değerle hesaplanır → CBAM sertifikası maliyetiniz şişer.", "en": "In the CBAM declaration your Scope 2 emissions default to the EU reference value → your CBAM certificate cost balloons.", "de": "In der CBAM-Erklärung werden Ihre Scope-2-Emissionen mit dem EU-Referenzwert angesetzt → Ihre CBAM-Zertifikatskosten steigen stark.", "fr": "Dans la déclaration MACF, vos émissions Scope 2 sont calculées avec la valeur de référence UE → votre coût en certificats MACF explose.", "es": "En la declaración MAFC, sus emisiones de Alcance 2 se calculan con el valor de referencia UE → el coste en certificados MAFC se dispara.", "it": "Nella dichiarazione CBAM le tue emissioni Scope 2 sono calcolate sul valore di riferimento UE → il costo dei certificati CBAM aumenta drasticamente."}, "bul_high_t": {"tr": "Voltfox ile yüksek eşleşme:", "en": "High matching with Voltfox:", "de": "Hohes Matching mit Voltfox:", "fr": "Appariement élevé avec Voltfox :", "es": "Alta coincidencia con Voltfox:", "it": "Alto matching con Voltfox:"}, "bul_high_s": {"tr": "Saatlik bazda eşleşen tüketim sıfır emisyon kabul edilir → CBAM yükümlülüğünüz orantılı şekilde düşer.", "en": "Consumption matched on an hourly basis counts as zero emissions → your CBAM liability falls proportionally.", "de": "Stündlich gematchter Verbrauch zählt als emissionsfrei → Ihre CBAM-Pflicht sinkt proportional.", "fr": "La consommation appariée horaire compte comme émission nulle → votre obligation MACF baisse proportionnellement.", "es": "El consumo emparejado por hora se contabiliza como emisión cero → su obligación MAFC disminuye proporcionalmente.", "it": "Il consumo matchato su base oraria conta come emissione zero → il tuo obbligo CBAM scende in modo proporzionale."}, "s4": {"tr": "4 · CBAM finansal parametreleri", "en": "4 · CBAM financial parameters", "de": "4 · CBAM-Finanzparameter", "fr": "4 · Paramètres financiers MACF", "es": "4 · Parámetros financieros MAFC", "it": "4 · Parametri finanziari CBAM"}, "lbl_ets": {"tr": "AB ETS sertifika fiyatı (€ / tCO₂)", "en": "EU ETS certificate price (€ / tCO₂)", "de": "EU-ETS-Zertifikatspreis (€ / tCO₂)", "fr": "Prix du certificat SEQE-UE (€ / tCO₂)", "es": "Precio del certificado RCDE UE (€ / tCO₂)", "it": "Prezzo certificato EU ETS (€ / tCO₂)"}, "lbl_local": {"tr": "Menşe ülkede ödenen karbon fiyatı (€ / tCO₂)", "en": "Carbon price paid in country of origin (€ / tCO₂)", "de": "Im Ursprungsland gezahlter CO₂-Preis (€ / tCO₂)", "fr": "Prix du carbone payé dans le pays d'origine (€ / tCO₂)", "es": "Precio del carbono pagado en el país de origen (€ / tCO₂)", "it": "Prezzo del carbonio pagato nel paese di origine (€ / tCO₂)"}, "lbl_year": {"tr": "CBAM yükümlülük yılı", "en": "CBAM compliance year", "de": "CBAM-Verpflichtungsjahr", "fr": "Année de conformité MACF", "es": "Año de cumplimiento MAFC", "it": "Anno di conformità CBAM"}, "hint_year": {"tr": "AB CBAM Tüzüğü Madde 36(2)(d) uyarınca ücretsiz tahsis 2026–2034 arasında kademeli olarak %0'a iner. Yılı kaydırarak yükümlülüğünüzün geçiş döneminde nasıl ölçekleneceğini görün.", "en": "Under Article 36(2)(d) of the EU CBAM Regulation, free allocation phases out from 2026 to 2034 (reaching 0%). Slide the year to see how your liability scales during the transitional period.", "de": "Gemäß Artikel 36(2)(d) der EU-CBAM-Verordnung wird die kostenlose Zuteilung von 2026 bis 2034 auf 0% reduziert. Verschieben Sie den Jahresregler, um die Skalierung Ihrer Pflicht in der Übergangsphase zu sehen.", "fr": "Conformément à l'article 36(2)(d) du règlement MACF UE, l'allocation gratuite est progressivement supprimée de 2026 à 2034 (atteignant 0%). Déplacez l'année pour voir comment votre obligation évolue pendant la période transitoire.", "es": "Según el artículo 36(2)(d) del Reglamento MAFC UE, la asignación gratuita se elimina gradualmente entre 2026 y 2034 (hasta 0%). Deslice el año para ver cómo escala su obligación en el período transitorio.", "it": "Ai sensi dell'articolo 36(2)(d) del Regolamento CBAM UE, l'assegnazione gratuita viene eliminata progressivamente dal 2026 al 2034 (fino allo 0%). Sposta l'anno per vedere come l'obbligo scala nel periodo transitorio."}, "meth_sum": {"tr": "Hesaplama metodolojisi", "en": "Calculation methodology", "de": "Berechnungsmethodik", "fr": "Méthodologie de calcul", "es": "Metodología de cálculo", "it": "Metodologia di calcolo"}, "card2_title": {"tr": "Sonuçlar", "en": "Results", "de": "Ergebnisse", "fr": "Résultats", "es": "Resultados", "it": "Risultati"}, "prod_empty": {"tr": "Bir ürün seçin.", "en": "Select a product.", "de": "Wählen Sie ein Produkt.", "fr": "Sélectionnez un produit.", "es": "Seleccione un producto.", "it": "Seleziona un prodotto."}, "viz_ef_title": {"tr": "Birim ürün başına gömülü emisyon faktörleri", "en": "Embedded emission factors per unit of product", "de": "Eingebettete Emissionsfaktoren je Produkteinheit", "fr": "Facteurs d'émissions intégrées par unité de produit", "es": "Factores de emisión incorporada por unidad de producto", "it": "Fattori di emissione incorporata per unità di prodotto"}, "ef_dir": {"tr": "Referans · doğrudan", "en": "Default · direct", "de": "Standard · direkt", "fr": "Par défaut · direct", "es": "Predeterminado · directo", "it": "Predefinito · diretto"}, "ef_ind": {"tr": "Referans · dolaylı (Scope 2)", "en": "Default · indirect (Scope 2)", "de": "Standard · indirekt (Scope 2)", "fr": "Par défaut · indirect (Scope 2)", "es": "Predeterminado · indirecto (Alcance 2)", "it": "Predefinito · indiretto (Scope 2)"}, "ef_act": {"tr": "Gerçekleşen Scope 2", "en": "Actual Scope 2 (after matching)", "de": "Tatsächlicher Scope 2 (nach Matching)", "fr": "Scope 2 réel (après appariement)", "es": "Alcance 2 real (tras coincidencia)", "it": "Scope 2 reale (post-matching)"}, "ef_tot": {"tr": "Toplam (gerçek veriyle)", "en": "Total (with your data)", "de": "Gesamt (mit Ihren Daten)", "fr": "Total (avec vos données)", "es": "Total (con sus datos)", "it": "Totale (con i tuoi dati)"}, "big_label": {"tr": "Yıllık CBAM yükümlülüğü", "en": "Annual CBAM liability", "de": "Jährliche CBAM-Pflicht", "fr": "Obligation MACF annuelle", "es": "Obligación MAFC anual", "it": "Obbligo CBAM annuo"}, "big_sub": {"tr": "(referans değerle)", "en": "(at default values)", "de": "(zu Standardwerten)", "fr": "(aux valeurs par défaut)", "es": "(con valores predeterminados)", "it": "(ai valori predefiniti)"}, "saving_label": {"tr": "Voltfox ile potansiyel yıllık tasarruf", "en": "Potential annual savings with Voltfox", "de": "Potenzielle jährliche Einsparungen mit Voltfox", "fr": "Économies annuelles potentielles avec Voltfox", "es": "Ahorro anual potencial con Voltfox", "it": "Risparmio annuo potenziale con Voltfox"}, "saving_legend": {"tr": "Referans dolaylı → gerçekleşen dolaylı", "en": "Default indirect → actual indirect", "de": "Standard indirekt → tatsächlich indirekt", "fr": "Indirect par défaut → indirect réel", "es": "Indirecto predeterminado → indirecto real", "it": "Indiretto predefinito → indiretto reale"}, "cbam_actual_label": {"tr": "Yıllık CBAM (gerçek veriyle)", "en": "Annual CBAM (with your data)", "de": "Jährliches CBAM (mit Ihren Daten)", "fr": "MACF annuel (avec vos données)", "es": "MAFC anual (con sus datos)", "it": "CBAM annuo (con i tuoi dati)"}, "risk_label": {"tr": "CBAM risk seviyesi", "en": "CBAM risk level", "de": "CBAM-Risikostufe", "fr": "Niveau de risque MACF", "es": "Nivel de riesgo MAFC", "it": "Livello di rischio CBAM"}, "risk_low": {"tr": "Düşük", "en": "Low", "de": "Gering", "fr": "Faible", "es": "Bajo", "it": "Basso"}, "risk_med": {"tr": "Orta", "en": "Moderate", "de": "Mittel", "fr": "Modéré", "es": "Moderado", "it": "Moderato"}, "risk_high": {"tr": "Yüksek", "en": "High", "de": "Hoch", "fr": "Élevé", "es": "Alto", "it": "Alto"}, "trend_title": {"tr": "2026 → 2034 CBAM yükümlülüğünün kademeli geçişi", "en": "2026 → 2034 CBAM phase-in trajectory", "de": "2026 → 2034 CBAM-Einführungsverlauf", "fr": "Trajectoire de mise en place du MACF 2026 → 2034", "es": "Trayectoria de implantación MAFC 2026 → 2034", "it": "Traiettoria di entrata in vigore CBAM 2026 → 2034"}, "lg_dv": {"tr": "Referans değerle", "en": "At default values", "de": "Mit Standardwerten", "fr": "Aux valeurs par défaut", "es": "Con valores predeterminados", "it": "Ai valori predefiniti"}, "lg_actual": {"tr": "Gerçek veriyle", "en": "With your data", "de": "Mit Ihren Daten", "fr": "Avec vos données", "es": "Con sus datos", "it": "Con i tuoi dati"}, "lg_current": {"tr": "Seçili yıl", "en": "Selected year", "de": "Ausgewähltes Jahr", "fr": "Année sélectionnée", "es": "Año seleccionado", "it": "Anno selezionato"}, "cta_lead": {"tr": "Detaylı analiz için demo talep edin →", "en": "Request a demo for detailed analysis →", "de": "Demo für detaillierte Analyse anfordern →", "fr": "Demander une démo pour une analyse détaillée →", "es": "Solicitar demo para análisis detallado →", "it": "Richiedi una demo per un'analisi dettagliata →"}, "cta_explore": {"tr": "Voltfox GreenLink platformunu inceleyin", "en": "Explore the Voltfox GreenLink platform", "de": "Voltfox-GreenLink-Plattform entdecken", "fr": "Découvrir la plateforme Voltfox GreenLink", "es": "Conozca la plataforma Voltfox GreenLink", "it": "Scopri la piattaforma Voltfox GreenLink"}, "f_name": {"tr": "Ad Soyad", "en": "Full name", "de": "Vor- und Nachname", "fr": "Nom complet", "es": "Nombre completo", "it": "Nome e cognome"}, "f_co": {"tr": "Şirket", "en": "Company", "de": "Unternehmen", "fr": "Société", "es": "Empresa", "it": "Azienda"}, "f_email": {"tr": "Kurumsal e-posta", "en": "Business email", "de": "Geschäftliche E-Mail", "fr": "E-mail professionnel", "es": "Correo corporativo", "it": "Email aziendale"}, "f_phone": {"tr": "Telefon (opsiyonel)", "en": "Phone (optional)", "de": "Telefon (optional)", "fr": "Téléphone (facultatif)", "es": "Teléfono (opcional)", "it": "Telefono (opzionale)"}, "f_submit": {"tr": "CBAM raporumu gönderin", "en": "Send my CBAM report", "de": "CBAM-Bericht senden", "fr": "Envoyer mon rapport MACF", "es": "Enviar mi informe MAFC", "it": "Inviami il report CBAM"}, "f_ok": {"tr": "Talebiniz alındı. Voltfox ekibi 1 iş günü içinde kişiselleştirilmiş CBAM raporunuzla iletişime geçecek.", "en": "Request received. The Voltfox team will reach out within 1 business day with your personalised CBAM report.", "de": "Anfrage erhalten. Das Voltfox-Team meldet sich innerhalb von 1 Werktag mit Ihrem personalisierten CBAM-Bericht.", "fr": "Demande reçue. L'équipe Voltfox vous contactera sous 1 jour ouvré avec votre rapport MACF personnalisé.", "es": "Solicitud recibida. El equipo de Voltfox se pondrá en contacto en 1 día laborable con su informe MAFC personalizado.", "it": "Richiesta ricevuta. Il team Voltfox ti contatterà entro 1 giorno lavorativo con il tuo report CBAM personalizzato."}, "info_text": {"tr": "Voltfox GreenLink, CBAM beyanlarında raporlanan Scope 2 dolaylı emisyonları saat ve lokasyon bazında gerçek üretim/tüketim verisiyle hesaplar. Referans değer yerine bağımsız doğrulamalı, denetim hazır bir değer kullanmanızı sağlar — CBAM yükümlülüğünüz tipik olarak %20–35 oranında azalır.", "en": "Voltfox GreenLink computes the Scope 2 indirect emissions reported in your CBAM declaration on an hour-by-hour, location-by-location basis using real generation and consumption data. This replaces the default value with an independently verified, audit-ready figure — typically lowering your CBAM liability by 20–35%.", "de": "Voltfox GreenLink berechnet die in Ihrer CBAM-Erklärung gemeldeten indirekten Scope-2-Emissionen stunden- und standortgenau auf Basis realer Erzeugungs- und Verbrauchsdaten. So ersetzen Sie den Standardwert durch einen unabhängig verifizierten, prüfsicheren Wert — typischerweise sinkt Ihre CBAM-Pflicht um 20–35%.", "fr": "Voltfox GreenLink calcule les émissions indirectes Scope 2 déclarées dans votre déclaration MACF heure par heure et site par site à partir de données réelles de production/consommation. Remplacez la valeur par défaut par une donnée vérifiée indépendamment et prête pour audit — votre obligation MACF baisse typiquement de 20 à 35%.", "es": "Voltfox GreenLink calcula las emisiones indirectas de Alcance 2 declaradas en su MAFC hora a hora y ubicación por ubicación con datos reales de generación y consumo. Sustituye el valor predeterminado por una cifra verificada independientemente y lista para auditoría — su obligación MAFC suele reducirse entre un 20 % y un 35 %.", "it": "Voltfox GreenLink calcola le emissioni indirette Scope 2 riportate nella tua dichiarazione CBAM ora per ora e sito per sito con dati reali di produzione/consumo. Sostituisci il valore predefinito con un dato verificato in modo indipendente e pronto per audit — il tuo obbligo CBAM tipicamente cala del 20–35%."}, "footer": {"tr": "© Voltfox · voltfox.io · Veri kaynağı: AB Komisyonu CBAM Referans Değerleri (v2026-02-04)", "en": "© Voltfox · voltfox.io · Data source: European Commission CBAM Default Values (v2026-02-04)", "de": "© Voltfox · voltfox.io · Datenquelle: CBAM-Standardwerte der EU-Kommission (v2026-02-04)", "fr": "© Voltfox · voltfox.io · Source : Valeurs par défaut MACF de la Commission européenne (v2026-02-04)", "es": "© Voltfox · voltfox.io · Fuente: Valores predeterminados MAFC de la Comisión Europea (v2026-02-04)", "it": "© Voltfox · voltfox.io · Fonte: Valori predefiniti CBAM della Commissione europea (v2026-02-04)"}, "b_qsi": {"tr": "QSI Doğrulamalı", "en": "QSI Verified", "de": "QSI-zertifiziert", "fr": "Vérifié QSI", "es": "Verificado por QSI", "it": "Verificato QSI"}, "free_alloc_pill": {"tr": "{y} · ücretsiz tahsis %{fa}", "en": "{y} · free allocation {fa}%", "de": "{y} · kostenlose Zuteilung {fa}%", "fr": "{y} · allocation gratuite {fa}%", "es": "{y} · asignación gratuita {fa}%", "it": "{y} · assegnazione gratuita {fa}%"}, "src_fallback": {"tr": "veri kaynağı: {c} (fallback)", "en": "data source: {c} (fallback)", "de": "Datenquelle: {c} (Fallback)", "fr": "source : {c} (repli)", "es": "fuente: {c} (alternativa)", "it": "fonte: {c} (fallback)"}, "meth_body": {"tr": "Referans değerler: AB Komisyonu CBAM Uygulama Tüzüğü Ek IV (04.02.2026). Her KN kodu için doğrudan + dolaylı ayrımı ve yıllara göre mark-up'lı versiyonlar yayımlanmıştır. · Gerçekleşen Scope 2 dolaylı = referans dolaylı × (1 − eşleşme oranı). Yıllık ortalama metodunda eşleşme oranı yıllık yenilenebilir hacim ÷ toplam tüketim; saatlik 24/7 CFE metodunda kullanıcı tarafından girilen orandır. · Toplam ürün emisyonu = doğrudan (referans) + gerçekleşen dolaylı. · CBAM yükümlülüğü = İhracat × Toplam emisyon × (1 − Ücretsiz Tahsis) × (AB ETS − Yerel Karbon). · Voltfox tasarrufu = referans dolaylı ile gerçekleşen dolaylı arasındaki fark × CBAM birim fiyat.", "en": "Default values: Annex IV of the EU CBAM Implementing Regulation (04.02.2026). For each CN code, direct and indirect components plus year-specific mark-ups are published. · Actual Scope 2 indirect = default indirect × (1 − match rate). Under annual-average matching the rate is annual renewable volume ÷ total consumption; under hourly 24/7 CFE it is the user-entered rate. · Total product emissions = direct (default) + actual indirect. · CBAM liability = exports × total emissions × (1 − free allocation) × (EU ETS − local carbon). · Voltfox savings = (default indirect − actual indirect) × CBAM unit price.", "de": "Standardwerte: Anhang IV der CBAM-Durchführungsverordnung (04.02.2026). Für jeden KN-Code sind direkte und indirekte Komponenten sowie jahresspezifische Aufschläge veröffentlicht. · Tatsächlicher Scope-2-Indirekt = Standard-Indirekt × (1 − Matching-Quote). Beim jährlichen Durchschnitt entspricht die Quote dem jährlichen Erneuerbaren-Volumen ÷ Gesamtverbrauch; beim stündlichen 24/7 CFE der vom Nutzer eingegebenen Quote. · Gesamtemissionen = direkt (Standard) + tatsächlich indirekt. · CBAM-Pflicht = Exporte × Gesamtemissionen × (1 − kostenlose Zuteilung) × (EU-ETS − lokaler CO₂-Preis). · Voltfox-Einsparung = (Standard-Indirekt − tatsächlich indirekt) × CBAM-Einheitspreis.", "fr": "Valeurs par défaut : annexe IV du règlement d'exécution MACF (04.02.2026). Pour chaque code NC, les composantes directe et indirecte ainsi que des majorations annuelles sont publiées. · Indirect Scope 2 réel = indirect par défaut × (1 − taux d'appariement). En moyenne annuelle, le taux est volume renouvelable annuel ÷ consommation totale ; en 24/7 CFE horaire, c'est le taux saisi par l'utilisateur. · Émissions totales = direct (par défaut) + indirect réel. · Obligation MACF = exportations × émissions totales × (1 − allocation gratuite) × (SEQE-UE − carbone local). · Économie Voltfox = (indirect par défaut − indirect réel) × prix unitaire MACF.", "es": "Valores predeterminados: Anexo IV del Reglamento de Ejecución MAFC (04.02.2026). Para cada código NC se publican los componentes directo e indirecto y los recargos anuales. · Indirecto Alcance 2 real = indirecto predeterminado × (1 − tasa de coincidencia). En promedio anual la tasa es volumen renovable anual ÷ consumo total; en 24/7 CFE horaria es la tasa introducida por el usuario. · Emisiones totales = directo (predeterminado) + indirecto real. · Obligación MAFC = exportaciones × emisiones totales × (1 − asignación gratuita) × (RCDE UE − carbono local). · Ahorro Voltfox = (indirecto predeterminado − indirecto real) × precio unitario MAFC.", "it": "Valori predefiniti: Allegato IV del Regolamento di esecuzione CBAM (04.02.2026). Per ciascun codice NC sono pubblicate le componenti diretta e indiretta più i mark-up annuali. · Indiretto Scope 2 reale = indiretto predefinito × (1 − tasso di matching). Nella media annuale il tasso è volume rinnovabile annuo ÷ consumo totale; nel 24/7 CFE orario è il tasso inserito dall'utente. · Emissioni totali = diretto (predefinito) + indiretto reale. · Obbligo CBAM = esportazioni × emissioni totali × (1 − assegnazione gratuita) × (EU ETS − carbonio locale). · Risparmio Voltfox = (indiretto predefinito − indiretto reale) × prezzo unitario CBAM."}};
  const LANGS = ["tr", "en", "de", "fr", "es", "it"];
  const LANG_NAMES = {"tr": "Türkçe", "en": "English", "de": "Deutsch", "fr": "Français", "es": "Español", "it": "Italiano"};
  let CURRENT_LANG = 'tr';
  function t(key, vars){
    const entry = I18N[key];
    if(!entry) return key;
    let s = entry[CURRENT_LANG] || entry['en'] || entry['tr'] || '';
    if(vars){ Object.keys(vars).forEach(k => { s = s.replace('{'+k+'}', vars[k]); }); }
    return s;
  }
  function applyLang(lang){
    if(!LANGS.includes(lang)) lang = 'tr';
    CURRENT_LANG = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      const tr = t(k);
      if(el.tagName === 'TITLE') document.title = tr;
      else el.textContent = tr;
    });
    // re-render dynamic strings
    if(typeof applyYear === 'function') applyYear();
    if(typeof calc === 'function') calc();
    try{ localStorage.setItem('voltfox_lang', lang); }catch(e){}
  }
  function detectLang(){
    try{ const saved = localStorage.getItem('voltfox_lang'); if(saved && LANGS.includes(saved)) return saved; }catch(e){}
    const navLangs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'tr'];
    for(const l of navLangs){ const base = (l||'').toLowerCase().split('-')[0]; if(LANGS.includes(base)) return base; }
    return 'tr';
  }
  (function initLangSelector(){
    const sel = document.getElementById('langSel'); if(!sel) return;
    LANGS.forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = LANG_NAMES[l]; sel.appendChild(o); });
    const initial = detectLang();
    sel.value = initial;
    sel.addEventListener('change', e => applyLang(e.target.value));
    applyLang(initial);
  })();


  // Populate country
  const sortedCountries = Object.keys(COUNTRIES).sort((a,b)=>a.localeCompare(b,'tr'));
  const cSel = $("country");
  sortedCountries.forEach(c => {
    const o = document.createElement("option"); o.value = c; o.textContent = c; cSel.appendChild(o);
  });
  if(COUNTRIES["Türkiye"]) cSel.value = "Türkiye";

  // Per-CN electricity intensity (MWh / ton of product).
  // Derived from CBAM default indirect EF (tCO2/ton) divided by a global average grid EF (0.45 tCO2/MWh, IEA 2024).
  // Computed once per CN as the median across all countries that have an indirect value.
  // User can override the autofilled value in the input.
  const GLOBAL_GRID_EF = 0.45; // tCO2/MWh — used only as denominator to invert indirect EF
  function median(arr){
    const a = arr.slice().sort((x,y)=>x-y);
    const n = a.length; if(!n) return null;
    return n%2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2;
  }
  const CN_ELEC = {}; // cn -> MWh/ton
  // (Built after CN_INDEX is constructed, see below.)
  function elecForCN(cn){ return cn && CN_ELEC[cn] != null ? CN_ELEC[cn] : null; }

  // Build CN_INDEX: for every CN code that has indirect data in any country, list those countries
  const CN_INDEX = {}; // cn -> { countries:{country:[direct,indirect,total,v2026,v2027,v2028]}, anyIndirect:bool }
  Object.keys(COUNTRIES).forEach(country => {
    COUNTRIES[country].forEach(r => {
      const [cn, direct, indirect, total, v2026, v2027, v2028] = r;
      if(!CN_INDEX[cn]) CN_INDEX[cn] = { countries:{}, anyIndirect:false };
      CN_INDEX[cn].countries[country] = [direct, indirect, total, v2026, v2027, v2028];
      if(indirect != null) CN_INDEX[cn].anyIndirect = true;
    });
  });
  // Universal product list: all CN codes where at least one country has indirect data
  const UNIVERSAL_CNS = Object.keys(CN_INDEX).filter(cn => CN_INDEX[cn].anyIndirect).sort();

  // Populate per-CN electricity intensity (median indirect EF / global grid EF)
  UNIVERSAL_CNS.forEach(cn => {
    const vals = Object.values(CN_INDEX[cn].countries).map(r => r[1]).filter(v => v != null && v > 0);
    const m = median(vals);
    if(m != null) CN_ELEC[cn] = +(m / GLOBAL_GRID_EF).toFixed(3);
  });

  // Populate categories from CN dict (only those present in universal list)
  const cats = Array.from(new Set(UNIVERSAL_CNS.map(cn => (CN[cn]||{}).c).filter(Boolean))).sort();
  const catSel = $("category");
  cats.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; catSel.appendChild(o); });

  function fillProducts(){
    const cat = catSel.value;
    const pSel = $("product"); pSel.innerHTML = "";
    UNIVERSAL_CNS.forEach(cn => {
      const info = CN[cn] || {d:cn,c:''};
      if(cat && info.c !== cat) return;
      const display = cn.replace(/(\d{4})(\d{2})(\d{2})?/, (m,a,b,c)=>c?`${a} ${b} ${c}`:`${a} ${b}`);
      const o = document.createElement("option");
      o.value = cn;
      o.textContent = `${display} — ${info.d}` + (info.c?` (${info.c})`:'');
      pSel.appendChild(o);
    });
    if(!pSel.options.length){
      const o = document.createElement("option"); o.value=""; o.textContent="Bu sektör için indirect veri olan CN kodu yok";
      pSel.appendChild(o);
    }
    // autofill electricity intensity for the first/selected product
    const cn = pSel.value;
    if(cn){
      const def = elecForCN(cn);
      if(def != null) $("elecPerUnit").value = def;
    }
    calc();
  }

  function currentRow(){
    const country = cSel.value;
    const cn = $("product").value;
    if(!cn || !CN_INDEX[cn]) return null;
    const info = CN[cn]||{d:'',c:''};
    let row = CN_INDEX[cn].countries[country];
    let source = country;
    // If selected country has no indirect (or no row), fall back to the maximum indirect across countries (AB methodology default)
    if(!row || row[1] == null){
      let best = null, bestCountry = null;
      Object.entries(CN_INDEX[cn].countries).forEach(([c, r]) => {
        if(r[1] != null && (best == null || r[1] > best[1])){ best = r; bestCountry = c; }
      });
      if(best){ row = best; source = t("src_fallback", { c: bestCountry }); }
    }
    if(!row) return null;
    return { cn, info, source,
      direct: row[0], indirect: row[1], total: row[2],
      v2026: row[3], v2027: row[4], v2028: row[5] };
  }

  function pickEF(r, period){
    // returns {direct, indirect, total} for the chosen period (with mark-up if applicable)
    // The DV table provides total mark-up versions; we apply same proportional scale to direct/indirect.
    const baseTotal = r.total;
    const periodTotal = r[period] != null ? r[period] : r.total;
    if(baseTotal && periodTotal != null){
      const k = periodTotal / baseTotal;
      return { direct: r.direct!=null?r.direct*k:null,
               indirect: r.indirect!=null?r.indirect*k:null,
               total: periodTotal };
    }
    return { direct: r.direct, indirect: r.indirect, total: r.total };
  }

  function calc(){
    const r = currentRow();
    const period = $("period").value;
    const volume = Math.max(0, parseFloat($("volume").value)||0);
    const elecPerUnit = Math.max(0, parseFloat($("elecPerUnit").value)||0);
    const gridEF = Math.max(0, parseFloat($("gridEF").value)||0);
    const renewMWh = Math.max(0, parseFloat($("renewMWh").value)||0);
    const matchMode = $("matchMode").value;
    const matchPct = Math.min(100,Math.max(0,parseFloat($("matchPct").value)||0))/100;
    const ets = Math.max(0, parseFloat($("etsPrice").value)||0);
    const freeAlloc = Math.min(100,Math.max(0,parseFloat($("freeAlloc").value)||0))/100;
    const domestic = Math.max(0, parseFloat($("domesticCarbon").value)||0);

    $("matchPctVal").textContent = ($("matchPct").value)+"%";

    if(!r){
      ["efDirect","efIndirect","efActual","efTotal","cbamCost","saving","cbamActual","risk"].forEach(id=>$(id).textContent="—");
      $("noDataAlert").classList.remove("show");
      $("prodSummary").textContent = t("prod_empty");
      return;
    }

    const ef = pickEF(r, period);
    const direct = ef.direct;
    const indirectDV = ef.indirect;

    // Show context
    const srcNote = (r.source && r.source !== cSel.value) ? ` <span class="pill">veri kaynağı: ${r.source}</span>` : '';
    $("prodSummary").innerHTML = `${cSel.value} · ${r.cn} — <strong>${r.info.d}</strong> ${r.info.c?'· '+r.info.c:''}${srcNote}`;
    $("noDataAlert").classList.toggle("show", r.source !== cSel.value);
    $("dvIndirectShow").textContent = fmt2(indirectDV);
    $("efDirect").textContent = fmt2(direct);
    $("efIndirect").textContent = fmt2(indirectDV);

    // Actual indirect: CBAM benchmark indirect EF, with the matched share zeroed out.
    // i.e. matched% of consumption → 0 emissions; unmatched% → default indirect EF.
    let effectiveMatch;
    const totalElec = elecPerUnit * volume;
    if(matchMode === "hourly"){
      effectiveMatch = matchPct;
    } else {
      effectiveMatch = totalElec>0 ? Math.min(renewMWh, totalElec)/totalElec : 0;
    }
    const baseIndirect = (indirectDV != null) ? indirectDV : 0;
    const actualIndirectPerUnit = baseIndirect * (1 - effectiveMatch);

    $("efActual").innerHTML = fmt2(actualIndirectPerUnit) + ` <small>(eşleşme ${(effectiveMatch*100).toFixed(0)}%)</small>`;

    const totalPerUnit_DV = (direct||0) + (indirectDV||0);
    const totalPerUnit_actual = (direct||0) + actualIndirectPerUnit;
    $("efTotal").textContent = fmt2(totalPerUnit_actual);

    const netPrice = Math.max(0, ets - domestic);
    const cbamFactor = (1 - freeAlloc) * netPrice;

    const cbamDV = volume * totalPerUnit_DV * cbamFactor;
    const cbamActual = volume * totalPerUnit_actual * cbamFactor;
    const totalEmissionsDV = volume * totalPerUnit_DV;
    const saving = Math.max(0, cbamDV - cbamActual);

    $("cbamCost").textContent = fmtEUR(cbamDV);
    $("cbamActual").textContent = fmtEUR(cbamActual);
    $("saving").textContent = fmtEUR(saving);
    $("vDisp").textContent = "İhracat: " + fmt(volume) + " birim";
    $("eDisp").textContent = "Toplam: " + fmt(totalEmissionsDV) + " tCO₂";

    const pct = cbamDV>0 ? Math.min(100, (saving/cbamDV)*100) : 0;
    $("savingBar").style.width = pct.toFixed(1)+"%";
    $("savingPct").textContent = pct.toFixed(1)+"%";

    let risk = t("risk_low"), color = "var(--accent)";
    if(cbamDV > 500000){ risk = t("risk_high"); color = "var(--danger)"; }
    else if(cbamDV > 100000){ risk = t("risk_med"); color = "var(--warn)"; }
    const re = $("risk"); re.textContent = risk; re.style.color = color;

    // EF bar chart widths (normalized to max of three values + total)
    const efMax = Math.max(direct||0, indirectDV||0, actualIndirectPerUnit||0, totalPerUnit_actual||0, 0.0001);
    $("efBarDirect").style.width   = (((direct||0)/efMax)*100).toFixed(1)+"%";
    $("efBarIndirect").style.width = (((indirectDV||0)/efMax)*100).toFixed(1)+"%";
    $("efBarActual").style.width   = ((actualIndirectPerUnit/efMax)*100).toFixed(1)+"%";
    $("efBarTotal").style.width    = ((totalPerUnit_actual/efMax)*100).toFixed(1)+"%";

    renderTrend(volume, direct||0, indirectDV||0, actualIndirectPerUnit, netPrice);
  }

  function renderTrend(volume, direct, indirectDV, indirectActual, netPrice){
    const chart = $("trendChart"); if(!chart) return;
    const totalDV = direct + indirectDV;
    const totalActual = direct + indirectActual;
    const selected = parseInt($("yearSlider").value,10);
    const years = Object.keys(FREE_ALLOC_BY_YEAR).map(Number).sort();
    const points = years.map(y => {
      const fa = FREE_ALLOC_BY_YEAR[y]/100;
      // mark-up factor: 2026=+10%, 2027=+20%, 2028+ = +30%
      const mk = y<=2026?1.10:(y===2027?1.20:1.30);
      const dv = volume * totalDV * mk * (1-fa) * netPrice;
      const ac = volume * totalActual * mk * (1-fa) * netPrice;
      return { y, dv, ac };
    });
    const max = Math.max(...points.map(p => Math.max(p.dv, p.ac)), 1);
    chart.innerHTML = points.map(p => {
      const hDV = (p.dv/max)*100;
      const hAC = (p.ac/max)*100;
      const isCur = p.y === selected;
      const tip = `${p.y}<br/>Default: ${fmtEUR(p.dv)}<br/>Sizin: ${fmtEUR(p.ac)}`;
      return `<div class="trend-col${isCur?' current':''}" data-year="${p.y}">
        <div class="trend-tooltip">${tip}</div>
        <div class="trend-bars">
          <div class="trend-bar dv" style="height:${hDV.toFixed(1)}%"></div>
          <div class="trend-bar actual" style="height:${hAC.toFixed(1)}%"></div>
        </div>
        <div class="trend-x">${p.y}</div>
      </div>`;
    }).join("");
    chart.querySelectorAll(".trend-col").forEach(col => {
      col.addEventListener("click", () => { $("yearSlider").value = col.dataset.year; applyYear(); });
    });
  }

  // Events
  // CBAM phase-out schedule (Article 36 — definitive period)
  const FREE_ALLOC_BY_YEAR = {
    2026:97.5, 2027:95.0, 2028:90.0, 2029:77.5, 2030:51.5,
    2031:39.0, 2032:26.5, 2033:14.0, 2034:0.0
  };
  function applyYear(){
    const y = parseInt($("yearSlider").value,10);
    const fa = FREE_ALLOC_BY_YEAR[y];
    $("freeAlloc").value = fa;
    $("yearVal").textContent = y;
    $("freeAllocPill").textContent = t("free_alloc_pill", { y: y, fa: fa.toString().replace(".",",") });
    // also align DV mark-up period
    if(y <= 2026) $("period").value = "v2026";
    else if(y === 2027) $("period").value = "v2027";
    else $("period").value = "v2028";
    calc();
  }
  $("yearSlider").addEventListener("input", applyYear);
  applyYear();

  // Match-toggle buttons
  document.querySelectorAll(".match-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".match-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $("matchMode").value = btn.dataset.mode;
      calc();
    });
  });

  cSel.addEventListener("change", calc);
  catSel.addEventListener("change", fillProducts);
  $("product").addEventListener("change", () => {
    const cn = $("product").value;
    const cat = (CN[cn]||{}).c;
    const def = elecForCN(cn, cat);
    if(def != null){ $("elecPerUnit").value = def; }
    calc();
  });
  ["product","volume","period","elecPerUnit","gridEF","renewMWh","matchMode","matchPct","etsPrice","freeAlloc","domesticCarbon"]
    .forEach(id => $(id).addEventListener("input", calc));

  $("leadBtn").addEventListener("click", () => {
    $("leadForm").classList.add("open"); $("leadBtn").style.display="none"; $("lname").focus();
  });
  $("leadForm").addEventListener("submit", e => {
    e.preventDefault();
    const r = currentRow();
    const payload = {
      name: $("lname").value, company: $("lcompany").value,
      email: $("lemail").value, phone: $("lphone").value,
      country: cSel.value, cn: r?r.cn:null, product: r?r.info.d:null,
      volume: $("volume").value, period: $("period").value,
      matchMode: $("matchMode").value, matchPct: $("matchPct").value,
      cbamDV: $("cbamCost").textContent, cbamActual: $("cbamActual").textContent,
      saving: $("saving").textContent, timestamp: new Date().toISOString()
    };
    if (!WEBHOOK_URL) { console.log("VOLTFOX_LEAD:", payload); }
    const form = e.target;
    const inputs = form.querySelectorAll("input");
    const submitBtn = form.querySelector("button[type=submit]");
    inputs.forEach(i => i.disabled = true);
    submitBtn.disabled = true;
    if (WEBHOOK_URL) {
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(res => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        $("okMsg").classList.add("show");
      }).catch(() => {
        inputs.forEach(i => i.disabled = false);
        submitBtn.disabled = false;
        submitBtn.textContent = t("f_submit_retry") || "Tekrar deneyin";
      });
    } else {
      $("okMsg").classList.add("show");
    }
  });

  fillProducts();
