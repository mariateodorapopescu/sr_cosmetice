import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import ast
import re

# clasa pt user
class User:
    def __init__(self, id, name, gender, age, skin_type, allergies):
        self.id = id
        self.name = name
        self.gender = gender
        self.age = age
        self.skin_type = skin_type
        self.allergies = allergies


## Normalizam coloanele
def normalize_text(text):
    if pd.isna(text):
        return ""
    text = re.sub(r'<.*?>', '', str(text))
    text = text.encode("ascii", "ignore").decode()
    text = re.sub(r'\s+', ' ', text)
    return text.strip().lower()


def get_n_recommandation(df_products, col1="highlights",col2="ingredients", id = "P433469", N=1):
    print(df_products.head(3), flush=True)
    # df_exp = df_products
    df_exp = df_products.copy()
    df_exp[col1] = df_exp[col1].apply(normalize_text)
    df_exp[col2] = df_exp[col2].apply(normalize_text)

    df_exp["final_description"] = (
    df_exp[col1].fillna('') + " " + df_exp[col2].fillna('')
    ).str.strip()

    df_exp["final_description"] = df_exp["final_description"].apply(normalize_text)
    df_exp = df_exp.drop_duplicates(subset=["final_description"])
    df_exp = df_exp.reset_index(drop=True)
    df_exp = df_exp[df_exp["final_description"].str.strip() != ""]
    df_exp = df_exp.drop_duplicates(subset=["final_description"])


    tfidf = TfidfVectorizer(stop_words='english')
    tfidf_matrix = tfidf.fit_transform(df_exp["final_description"])

    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)

    produs_index = df_exp.index.get_loc(df_exp[df_exp["product_id"] == id].index[0])

    ## similaritate produs dorit cu celelalte
    similarities = cosine_sim[produs_index]
    similarities[produs_index] = 0

    max_score = 0
    similarities[produs_index] = -1
    top_indices = np.argsort(similarities)[::-1]

    return top_indices[:N]

# Filtrare dupa un camp anume si cuvant cheie
def filter(df, column="highlights", keyword=""):
    def contains_keyword(x):
        if isinstance(x, list):
            return any(keyword.lower() in str(i).lower() for i in x)

        if isinstance(x, str):
            try:
                parsed = ast.literal_eval(x)
                if isinstance(parsed, list):
                    return any(keyword.lower() in str(i).lower() for i in parsed)
            except:
                return keyword.lower() in x.lower()

        return False
    return df[df[column].apply(contains_keyword)].copy()

# Filtrare elimina in functie de continut
def filter_out(df, column="highlights", keyword=""):
    def contains_keyword(x):
        if isinstance(x, list):
            return any(keyword.lower() not in str(i).lower() for i in x)

        if isinstance(x, str):
            try:
                parsed = ast.literal_eval(x)
                if isinstance(parsed, list):
                    return any(keyword.lower() not in str(i).lower() for i in parsed)
            except:
                return keyword.lower() not in x.lower()

        return True
    return df[df[column].apply(contains_keyword)].copy()