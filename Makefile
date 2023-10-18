SOURCE_FILES := $(shell find -name '*.md')
COMPILED_FILES := $(patsubst %.md,%.html,$(SOURCE_FILES))

.PHONY: all
all: $(COMPILED_FILES)

.PHONY: clean
clean:
	rm $(COMPILED_FILES)

$(COMPILED_FILES): %.html: %.md
	marked -i $^ -o $@
