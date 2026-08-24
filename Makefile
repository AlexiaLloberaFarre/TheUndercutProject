.PHONY: test validate build sample compute clean

PYTHON ?= python3
DATA   ?= data/sample
START  ?= 2026-01-06
AS_OF  ?= 2026-08-24

test:            ## run the full suite (Python formulas + JS/Python parity)
	$(PYTHON) -m unittest discover -s tests -t .

validate:        ## structural check of framework/kpi_catalogue.json
	$(PYTHON) -m kpi_framework validate

compute:         ## print the scorecard as a table
	$(PYTHON) -m kpi_framework compute --data $(DATA) --start $(START) --as-of $(AS_OF) --targets-agreed

build:           ## build the self-contained dashboard into dist/
	$(PYTHON) -m kpi_framework build --data $(DATA) --start $(START) --as-of $(AS_OF) --out dist/dashboard.html

export:          ## write dist/scorecard.csv for a review pack
	$(PYTHON) -m kpi_framework export --data $(DATA) --start $(START) --as-of $(AS_OF) --targets-agreed --format csv --out dist/scorecard.csv

sample:          ## regenerate the fictional sample dataset
	$(PYTHON) scripts/make_sample_data.py

clean:
	rm -rf dist
