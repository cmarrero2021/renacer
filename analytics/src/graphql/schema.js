// analytics/src/graphql/schema.js
const {
    GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLFloat,
    GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLInputObjectType, GraphQLEnumType
} = require('graphql');
const { resolvers } = require('./resolvers');

// ─── Enum Types ───────────────────────────────────────────────────────────────

const AggregationEnum = new GraphQLEnumType({
    name: 'Aggregation',
    values: {
        SUM: { value: 'SUM' },
        COUNT: { value: 'COUNT' },
        AVG: { value: 'AVG' },
        MIN: { value: 'MIN' },
        MAX: { value: 'MAX' },
    }
});

// ─── Output Types ─────────────────────────────────────────────────────────────

const GeografiaType = new GraphQLObjectType({
    name: 'Geografia',
    fields: {
        estado: { type: GraphQLString },
        municipio: { type: GraphQLString },
        parroquia: { type: GraphQLString },
    }
});

const PropietarioType = new GraphQLObjectType({
    name: 'Propietario',
    fields: {
        id: { type: GraphQLInt },
        nombre: { type: GraphQLString },
        cedula_tipo: { type: GraphQLString },
        cedula_nro: { type: GraphQLString },
        es_principal: { type: GraphQLBoolean },
    }
});

const RepresentanteType = new GraphQLObjectType({
    name: 'Representante',
    fields: {
        id: { type: GraphQLInt },
        nombre: { type: GraphQLString },
        cedula_tipo: { type: GraphQLString },
        cedula_nro: { type: GraphQLString },
        cargo: { type: GraphQLString },
    }
});

const TelefonoType = new GraphQLObjectType({
    name: 'Telefono',
    fields: {
        id: { type: GraphQLInt },
        telefono: { type: GraphQLString },
        tipo: { type: GraphQLString },
    }
});

const CorreoType = new GraphQLObjectType({
    name: 'Correo',
    fields: {
        id: { type: GraphQLInt },
        correo: { type: GraphQLString },
        tipo: { type: GraphQLString },
    }
});

const CapacidadType = new GraphQLObjectType({
    name: 'Capacidad',
    fields: {
        id: { type: GraphQLInt },
        capacidad_total_residente: { type: GraphQLInt },
        capacidad_actual_residente: { type: GraphQLInt },
        atencion_ambulatoria: { type: GraphQLBoolean },
        num_atencion_ambulatoria: { type: GraphQLInt },
    }
});

const PersonalType = new GraphQLObjectType({
    name: 'Personal',
    fields: {
        id: { type: GraphQLInt },
        num_medicos_geriatra: { type: GraphQLInt },
        num_medicos_psiquiatra: { type: GraphQLInt },
        num_enfermeros: { type: GraphQLInt },
        num_cuidadores: { type: GraphQLInt },
        num_camareros: { type: GraphQLInt },
        num_auxiliares_enfermeria: { type: GraphQLInt },
        num_servicios_generales: { type: GraphQLInt },
        num_personal_cocina: { type: GraphQLInt },
        num_personal_no_adscrito: { type: GraphQLInt },
        descripcion_no_adscrito: { type: GraphQLString },
        posee_expediente_curricular: { type: GraphQLBoolean },
        otros_personal: { type: GraphQLBoolean },
        descripcion_otros_personal: { type: GraphQLString },
    }
});

const ServiciosType = new GraphQLObjectType({
    name: 'Servicios',
    fields: {
        id: { type: GraphQLInt },
        farmacia: { type: GraphQLBoolean },
        evaluacion_nutricional: { type: GraphQLBoolean },
        actividades_recreativas: { type: GraphQLBoolean },
        servicio_emergencia: { type: GraphQLBoolean },
        servicio_funerario: { type: GraphQLBoolean },
        medicos: { type: GraphQLBoolean },
        medicos_descripcion: { type: GraphQLString },
        lavanderia: { type: GraphQLBoolean },
        lavanderia_descripcion: { type: GraphQLString },
        barberia_peluqueria: { type: GraphQLBoolean },
        otros: { type: GraphQLBoolean },
        otros_descripcion: { type: GraphQLString },
    }
});

const InfraestructuraType = new GraphQLObjectType({
    name: 'Infraestructura',
    fields: {
        id: { type: GraphQLInt },
        estado_inmueble: { type: GraphQLString },
        num_dormitorios: { type: GraphQLInt },
        dormitorios_adecuados: { type: GraphQLBoolean },
        num_sanitarios: { type: GraphQLInt },
        sanitarios_adecuados: { type: GraphQLBoolean },
        tiene_area_cocina: { type: GraphQLBoolean },
        cocina_adecuada: { type: GraphQLBoolean },
        ventilacion_adecuada: { type: GraphQLBoolean },
        iluminacion_adecuada: { type: GraphQLBoolean },
        capacidad_comedor_pct: { type: GraphQLFloat },
        luz_electrica: { type: GraphQLBoolean },
        agua_potable: { type: GraphQLBoolean },
        agua_servidas: { type: GraphQLBoolean },
        deposito_basura: { type: GraphQLBoolean },
        sistema_seguridad: { type: GraphQLBoolean },
        descripcion_otros: { type: GraphQLString },
    }
});

const PoblacionType = new GraphQLObjectType({
    name: 'Poblacion',
    fields: {
        id: { type: GraphQLInt },
        fecha_corte: { type: GraphQLString },
        modalidad: { type: GraphQLString },
        categoria: { type: GraphQLString },
        femenino: { type: GraphQLInt },
        masculino: { type: GraphQLInt },
        total: { type: GraphQLInt },
    }
});

const DocumentoType = new GraphQLObjectType({
    name: 'Documento',
    fields: {
        id: { type: GraphQLInt },
        tipo_documento: { type: GraphQLString },
        tiene_original: { type: GraphQLBoolean },
        tiene_copia: { type: GraphQLBoolean },
        descripcion: { type: GraphQLString },
    }
});

const FichaType = new GraphQLObjectType({
    name: 'Ficha',
    fields: {
        id: { type: GraphQLInt },
        centro_id: { type: GraphQLInt },
        version: { type: GraphQLInt },
        fecha_solicitud: { type: GraphQLString },
        nro_registro_nacional: { type: GraphQLString },
        tipo_solicitud: { type: GraphQLString },
        fecha_fundacion: { type: GraphQLString },
        costo_mensual: { type: GraphQLFloat },
        direccion: { type: GraphQLString },
        is_current: { type: GraphQLBoolean },
        capacidad: { type: CapacidadType },
        personal: { type: PersonalType },
        servicios: { type: ServiciosType },
        infraestructura: { type: InfraestructuraType },
        poblacion: { type: new GraphQLList(PoblacionType) },
        documentos: { type: new GraphQLList(DocumentoType) },
    }
});

const CentroType = new GraphQLObjectType({
    name: 'Centro',
    fields: {
        id: { type: GraphQLInt },
        nombre_establecimiento: { type: GraphQLString },
        tipo_establecimiento: { type: GraphQLString },
        tipo_establecimiento_descripcion: { type: GraphQLString },
        tipo_clasificacion: { type: GraphQLString },
        estado_centro: { type: GraphQLString },
        rif: { type: GraphQLString },
        nro_registro_mercantil: { type: GraphQLString },
        latitud: { type: GraphQLFloat },
        longitud: { type: GraphQLFloat },
        estado: { type: GraphQLString },
        municipio: { type: GraphQLString },
        parroquia: { type: GraphQLString },
        ficha_actual: { type: FichaType },
        propietarios: { type: new GraphQLList(PropietarioType) },
        representantes: { type: new GraphQLList(RepresentanteType) },
        telefonos: { type: new GraphQLList(TelefonoType) },
        correos: { type: new GraphQLList(CorreoType) },
    }
});

// ─── Dashboard Data (flat rows for pivot) ─────────────────────────────────────

const DashboardRowType = new GraphQLObjectType({
    name: 'DashboardRow',
    fields: {
        // Campos se resuelven dinámicamente como JSON
        data: { type: GraphQLString }, // JSON stringified row
    }
});

const DashboardResultType = new GraphQLObjectType({
    name: 'DashboardResult',
    fields: {
        columns: { type: new GraphQLList(GraphQLString) },
        rows: { type: GraphQLString }, // JSON array of row objects
        totalRows: { type: GraphQLInt },
    }
});

// ─── Input Types ──────────────────────────────────────────────────────────────

const FilterInput = new GraphQLInputObjectType({
    name: 'FilterInput',
    fields: {
        field: { type: new GraphQLNonNull(GraphQLString) },
        operator: { type: GraphQLString, defaultValue: 'eq' }, // eq, neq, gt, lt, gte, lte, in, like
        value: { type: new GraphQLNonNull(GraphQLString) },
    }
});

const FieldConfigInput = new GraphQLInputObjectType({
    name: 'FieldConfigInput',
    fields: {
        field: { type: new GraphQLNonNull(GraphQLString) },
        aggregation: { type: AggregationEnum },
    }
});

// ─── Root Query ───────────────────────────────────────────────────────────────

const RootQuery = new GraphQLObjectType({
    name: 'Query',
    fields: {
        // Consulta de centros con datos completos
        centros: {
            type: new GraphQLList(CentroType),
            args: {
                tipo_establecimiento: { type: GraphQLString },
                tipo_clasificacion: { type: GraphQLString },
                estado_centro: { type: GraphQLString },
                estado: { type: GraphQLString },
                municipio: { type: GraphQLString },
            },
            resolve: resolvers.centros,
        },

        // Centro individual
        centro: {
            type: CentroType,
            args: {
                id: { type: new GraphQLNonNull(GraphQLInt) },
            },
            resolve: resolvers.centro,
        },

        // Consulta principal para el dashboard / tabla pivote
        dashboardData: {
            type: DashboardResultType,
            args: {
                fields: { type: new GraphQLList(GraphQLString) },
                filters: { type: new GraphQLList(FilterInput) },
                groupBy: { type: new GraphQLList(GraphQLString) },
                values: { type: new GraphQLList(FieldConfigInput) },
                limit: { type: GraphQLInt },
            },
            resolve: resolvers.dashboardData,
        },

        // Metadata: campos disponibles para el dashboard
        availableFields: {
            type: GraphQLString, // JSON con la lista de campos
            resolve: resolvers.availableFields,
        },
    }
});

const schema = new GraphQLSchema({
    query: RootQuery,
});

module.exports = { schema };
