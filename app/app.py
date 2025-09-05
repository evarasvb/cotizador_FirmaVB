import io
import pandas as pd
import streamlit as st
from fuzzywuzzy import fuzz

st.set_page_config(page_title="Cotizador FirmaVB", page_icon="📦")
st.title("Cotizador automático - Prototipo")


@st.cache_data
def load_catalog(path: str = "data/catalogo.csv") -> pd.DataFrame:
    """Carga el catálogo desde un archivo CSV. En producción, debería llamarse al
    servicio de catálogo (catalog_service) para obtener los datos actualizados.
    """
    try:
        df = pd.read_csv(path)
        return df.fillna("")
    except FileNotFoundError:
        st.warning("No se encontró el catálogo en data/catalogo.csv. Carga uno antes de iniciar.")
        return pd.DataFrame(columns=["sku", "nombre", "sinonimos", "unidad", "pack", "precio", "marca", "region", "stock"])


def match_items(request_df: pd.DataFrame, catalog_df: pd.DataFrame) -> pd.DataFrame:
    """Hace una coincidencia básica entre los ítems solicitados y el catálogo.
    Este ejemplo usa coincidencia difusa en la columna 'nombre'. Puedes reemplazar
    esta función con llamadas al servicio de catálogo o tu propia lógica de embeddings.
    """
    results = []
    for _, req in request_df.iterrows():
        descripcion = str(req.get("descripcion", ""))
        qty = req.get("qty", 1)
        unidad = req.get("unidad", "unidad")
        codigo = str(req.get("codigo", ""))

        # Buscamos coincidencia exacta por código
        match = None
        if codigo:
            match = catalog_df[catalog_df["sku"].astype(str).str.lower() == codigo.lower()].head(1)
        # Si no hay coincidencia exacta, usamos coincidencia difusa
        if match is None or match.empty:
            catalog_df["fuzzy_score"] = catalog_df["nombre"].apply(lambda x: fuzz.token_sort_ratio(descripcion, str(x)))
            match = catalog_df.sort_values("fuzzy_score", ascending=False).head(1)

        if not match.empty:
            row = match.iloc[0]
            results.append({
                "descripcion_solicitada": descripcion,
                "sku": row.get("sku"),
                "nombre_catalogo": row.get("nombre"),
                "precio_unitario": row.get("precio"),
                "qty": qty,
                "subtotal": qty * float(row.get("precio") or 0),
                "score": row.get("fuzzy_score", 100) / 100.0,
                "status": "exact" if codigo and row.get("sku") == codigo else "fuzzy",
            })
    return pd.DataFrame(results)


def main():
    st.subheader("Paso 1: Carga del catálogo (opcional)")
    catalog_file = st.file_uploader("Carga un catálogo CSV con las columnas mínimas (sku, nombre, precio)", type=["csv", "txt"], key="catalog")
    if catalog_file:
        catalog_df = pd.read_csv(catalog_file).fillna("")
    else:
        catalog_df = load_catalog()

    st.write(f"Catálogo cargado: {len(catalog_df)} productos")

    st.subheader("Paso 2: Carga de requerimientos del cliente")
    req_file = st.file_uploader("Carga un archivo CSV o Excel con tus requerimientos", type=["csv", "xlsx", "xls"], key="req")
    if req_file:
        # Leer CSV o Excel
        if req_file.name.endswith(".csv"):
            req_df = pd.read_csv(req_file)
        else:
            req_df = pd.read_excel(req_file)
        # Normalizar columnas
        req_df.columns = [c.lower().strip() for c in req_df.columns]
        if "descripcion" not in req_df.columns:
            st.error("El archivo debe contener una columna 'descripcion'")
            return
        if "qty" not in req_df.columns:
            req_df["qty"] = 1
        if "unidad" not in req_df.columns:
            req_df["unidad"] = "unidad"
        if "codigo" not in req_df.columns:
            req_df["codigo"] = ""

        st.write("Requerimientos cargados:")
        st.dataframe(req_df)

        if st.button("Generar cotización"):
            with st.spinner("Generando coincidencias..."):
                result_df = match_items(req_df, catalog_df)
            st.write("Resultado de coincidencias:")
            st.dataframe(result_df)
            st.write(f"Total: {result_df['subtotal'].sum():.2f}")
            # Descarga de la cotización
            csv_buffer = io.StringIO()
            result_df.to_csv(csv_buffer, index=False)
            st.download_button(label="Descargar cotización CSV", data=csv_buffer.getvalue(), file_name="cotizacion.csv", mime="text/csv")

if __name__ == "__main__":
    main()
