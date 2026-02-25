<template>
    <q-page padding>
        <div class="text-h4 q-mb-md">Marco Legal</div>

        <!-- Documentos descargables -->
        <q-card class="q-mb-lg">
            <q-card-section>
                <div class="text-h6 q-mb-sm">
                    <q-icon name="description" class="q-mr-sm" />Documentos
                </div>
                <q-list separator>
                    <q-item clickable tag="a" href="/documentos/constitucion-CRBV.PDF" target="_blank">
                        <q-item-section avatar>
                            <q-icon name="picture_as_pdf" color="red" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Constitución de la República Bolivariana de Venezuela</q-item-label>
                            <q-item-label caption>CRBV - Gaceta Oficial</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-icon name="open_in_new" color="grey" />
                        </q-item-section>
                    </q-item>

                    <q-item clickable tag="a" href="/documentos/2021_leyadultomayor_ven.pdf" target="_blank">
                        <q-item-section avatar>
                            <q-icon name="picture_as_pdf" color="red" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Ley Orgánica para la Atención y Desarrollo Integral de las Personas Adultas
                                Mayores</q-item-label>
                            <q-item-label caption>Gaceta Oficial Extraordinaria Nº 6.641 - 2021</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-icon name="open_in_new" color="grey" />
                        </q-item-section>
                    </q-item>

                    <q-item clickable tag="a" href="/documentos/2005_lesy_servicios_sociales.pdf" target="_blank">
                        <q-item-section avatar>
                            <q-icon name="picture_as_pdf" color="red" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>Ley de Servicios Sociales</q-item-label>
                            <q-item-label caption>Gaceta Oficial Nº 38.270 - 2005</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-icon name="open_in_new" color="grey" />
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-card-section>
        </q-card>

        <!-- Tabs con artículos -->
        <q-card>
            <q-tabs v-model="tab" dense class="text-grey" active-color="primary" indicator-color="primary"
                align="justify" narrow-indicator>
                <q-tab name="crbv" label="CRBV" icon="account_balance" />
                <q-tab name="ley_adulto" label="Ley del Adulto Mayor" icon="elderly" />
                <q-tab name="ley_servicios" label="Ley de Servicios Sociales" icon="volunteer_activism" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="tab" animated>
                <!-- CRBV -->
                <q-tab-panel name="crbv">
                    <div class="text-h6 q-mb-md">Constitución de la República Bolivariana de Venezuela</div>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 80</div>
                            <p class="text-body2" style="text-align: justify;">
                                El Estado garantizará a los ancianos y ancianas el pleno ejercicio de sus derechos y
                                garantías.
                                El Estado, con la participación solidaria de las familias y la sociedad, está obligado a
                                respetar su
                                dignidad humana, su autonomía y les garantizará atención integral y los beneficios de la
                                seguridad
                                social que eleven y aseguren su calidad de vida. Las pensiones y jubilaciones otorgadas
                                mediante el
                                sistema de Seguridad Social no podrán ser inferiores al salario mínimo urbano. A los
                                ancianos y
                                ancianas se les garantizará el derecho a un trabajo acorde con aquellos y aquellas que
                                manifiesten
                                su deseo y estén en capacidad para ello.
                            </p>
                        </q-card-section>
                    </q-card>
                </q-tab-panel>

                <!-- Ley Orgánica del Adulto Mayor -->
                <q-tab-panel name="ley_adulto">
                    <div class="text-h6 q-mb-md">Ley Orgánica para la Atención y Desarrollo Integral de las Personas
                        Adultas
                        Mayores</div>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 8 - Definiciones
                            </div>
                            <p class="text-body2" style="text-align: justify;">
                                A los efectos de la presente Ley, se entenderá por:<br /><br />
                                <strong>Persona adulta mayor:</strong> Toda persona de sesenta años de edad o más.<br />
                                <strong>Centro de atención integral:</strong> Establecimiento donde se presta atención
                                integral a las
                                personas adultas mayores, en las áreas de salud, alimentación, recreación, cultura,
                                deporte y
                                desarrollo social, entre otros servicios, con el fin de contribuir a mejorar su calidad
                                de vida.<br />
                                <strong>Residencia de larga estadía:</strong> Establecimiento donde se brinda
                                alojamiento permanente
                                o temporal, alimentación, atención médica, cuidados de enfermería, recreación y demás
                                servicios
                                necesarios para la atención integral de las personas adultas mayores.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 11 - Derechos
                            </div>
                            <p class="text-body2" style="text-align: justify;">
                                Las personas adultas mayores tienen derecho a:<br /><br />
                                1. La vida y a la integridad personal.<br />
                                2. La dignidad e igualdad.<br />
                                3. El respeto a su autonomía e independencia.<br />
                                4. La participación activa en la vida familiar, comunitaria y social.<br />
                                5. La atención integral en salud.<br />
                                6. La educación, cultura, recreación, descanso y esparcimiento.<br />
                                7. El trabajo digno y la seguridad social.<br />
                                8. La vivienda digna y segura.<br />
                                9. La alimentación adecuada y suficiente.<br />
                                10. La información y orientación oportuna y veraz.<br />
                                11. La protección contra toda forma de explotación, maltrato y discriminación.<br />
                                12. El acceso a la justicia.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 19 - Registro
                                Nacional</div>
                            <p class="text-body2" style="text-align: justify;">
                                El ministerio del poder popular con competencia en materia de atención a las personas
                                adultas
                                mayores creará el Registro Nacional de Centros de Atención Integral, Residencias de
                                Larga Estadía
                                y demás establecimientos destinados a la atención de las personas adultas mayores, el
                                cual será
                                público y de libre acceso. Los centros y residencias deberán inscribirse en dicho
                                Registro como
                                condición para su funcionamiento.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 37 - Centros de
                                Atención
                                Integral</div>
                            <p class="text-body2" style="text-align: justify;">
                                Los centros de atención integral para las personas adultas mayores son establecimientos
                                que
                                brindan servicios de atención diurna o permanente, según su modalidad, y deben
                                garantizar
                                condiciones de habitabilidad, salubridad, seguridad y accesibilidad, así como la
                                atención
                                profesional y técnica necesaria para el cuidado integral de las personas adultas
                                mayores.
                                Estos centros estarán sujetos a la supervisión y control del ministerio del poder
                                popular
                                con competencia en la materia.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 38 - Requisitos
                                de
                                Funcionamiento</div>
                            <p class="text-body2" style="text-align: justify;">
                                Los centros de atención integral y las residencias de larga estadía para las personas
                                adultas mayores
                                deberán cumplir con los requisitos establecidos por el ministerio del poder popular con
                                competencia
                                en la materia, relativos a infraestructura, equipamiento, recursos humanos, protocolos
                                de atención,
                                planes de emergencia, y demás condiciones necesarias para garantizar la atención
                                integral y la
                                calidad de vida de las personas adultas mayores. El incumplimiento de estos requisitos
                                dará lugar
                                a las sanciones previstas en esta Ley.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 40 - Inspección y
                                Supervisión</div>
                            <p class="text-body2" style="text-align: justify;">
                                El ministerio del poder popular con competencia en materia de atención a las personas
                                adultas
                                mayores, a través de sus órganos y entes adscritos, realizará inspecciones periódicas a
                                los
                                centros de atención integral y residencias de larga estadía, a fin de verificar el
                                cumplimiento
                                de los requisitos y condiciones establecidos en esta Ley y su Reglamento. Los
                                funcionarios y
                                funcionarias encargados de la inspección tendrán libre acceso a dichos establecimientos
                                y podrán
                                solicitar la información y documentación que estimen necesaria.
                            </p>
                        </q-card-section>
                    </q-card>
                </q-tab-panel>

                <!-- Ley de Servicios Sociales -->
                <q-tab-panel name="ley_servicios">
                    <div class="text-h6 q-mb-md">Ley de Servicios Sociales</div>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 23 - Servicios
                                Sociales para
                                Personas Adultas Mayores</div>
                            <p class="text-body2" style="text-align: justify;">
                                Los servicios sociales para las personas adultas mayores comprenden el conjunto de
                                prestaciones,
                                programas y actividades dirigidos a garantizar su atención integral, promover su
                                autonomía personal,
                                prevenir y atender situaciones de dependencia, y contribuir a mejorar su calidad de
                                vida. Estos
                                servicios serán prestados por el Estado, directamente o a través de las instituciones
                                públicas
                                o privadas autorizadas para tal fin.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 31 - Modalidades
                                de
                                Atención</div>
                            <p class="text-body2" style="text-align: justify;">
                                La atención a las personas adultas mayores se prestará bajo las siguientes
                                modalidades:<br /><br />
                                1. <strong>Atención domiciliaria:</strong> Conjunto de servicios de carácter social y
                                sanitario que
                                se prestan en el domicilio de la persona adulta mayor.<br />
                                2. <strong>Atención diurna:</strong> Servicios de atención integral durante el día en
                                centros
                                especializados.<br />
                                3. <strong>Atención residencial:</strong> Alojamiento temporal o permanente en
                                residencias de
                                larga estadía para personas adultas mayores que requieran cuidados continuos.<br />
                                4. <strong>Atención comunitaria:</strong> Programas y actividades desarrollados en el
                                ámbito
                                comunitario orientados a la integración social de las personas adultas mayores.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 38 - Registro y
                                Autorización</div>
                            <p class="text-body2" style="text-align: justify;">
                                Los establecimientos públicos y privados dedicados a la prestación de servicios sociales
                                para
                                las personas adultas mayores deberán inscribirse en el registro correspondiente y
                                obtener la
                                autorización del órgano rector en la materia, como condición previa para su
                                funcionamiento.
                                Dicho registro será público y estará a disposición de la ciudadanía para fines de
                                consulta
                                e información.
                            </p>
                        </q-card-section>
                    </q-card>

                    <q-card flat bordered class="q-mb-md">
                        <q-card-section>
                            <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Artículo 59 - Sanciones
                            </div>
                            <p class="text-body2" style="text-align: justify;">
                                Los centros de atención y residencias que funcionen sin la debida autorización o que
                                incumplan
                                los requisitos establecidos en esta Ley y su Reglamento, serán sancionados con multa,
                                clausura
                                temporal o definitiva del establecimiento, según la gravedad de la infracción, sin
                                perjuicio
                                de las responsabilidades civiles y penales a que hubiere lugar. El órgano rector en la
                                materia
                                será el competente para imponer las sanciones previstas en este artículo, garantizando
                                el
                                debido proceso.
                            </p>
                        </q-card-section>
                    </q-card>
                </q-tab-panel>
            </q-tab-panels>
        </q-card>
    </q-page>
</template>

<script setup>
import { ref } from 'vue'

const tab = ref('crbv')
</script>
